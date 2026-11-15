import type { AppConfig } from "./config.js";
import type { Logger } from "./logger.js";
import { LibrusClient, type MessageSummary } from "./librus/client.js";
import { StateStore, type FolderState, type InFlight } from "./state/store.js";
import type { Notifier } from "./notifiers/types.js";
import { MessageArchiver } from "./archive/messageArchiver.js";

const MAX_MESSAGE_ATTEMPTS = 3;

export interface FetchStatus {
  running: boolean;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
}

export class FetchJob {
  private running = false;
  private pending = false;
  private lastSuccessAt: string | null = null;
  private lastFailureAt: string | null = null;
  private consecutiveFailures = 0;

  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
    private readonly stateStore: StateStore,
    private readonly notifiers: Notifier[],
    private readonly archiver: MessageArchiver,
  ) {}

  trigger(): void {
    if (this.running) {
      this.pending = true;
      this.logger.info({ event: "fetch_queued" }, "Fetch już w toku, kolejne wywołanie zaczeka");
      return;
    }
    void this.runLoop();
  }

  getStatus(): FetchStatus {
    return {
      running: this.running,
      lastSuccessAt: this.lastSuccessAt,
      lastFailureAt: this.lastFailureAt,
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  private async runLoop(): Promise<void> {
    this.running = true;
    try {
      do {
        this.pending = false;
        await this.runWithDeadline();
      } while (this.pending);
    } finally {
      this.running = false;
    }
  }

  // Twardy limit czasu na cały przebieg: zawieszone żądanie do Librusa nie może zablokować `running`
  // na zawsze. Po przekroczeniu limitu sygnał abort zatrzymuje spóźniony przebieg przed
  // kolejnym zapisem stanu/powiadomieniem.
  private async runWithDeadline(): Promise<void> {
    const startedAt = Date.now();
    const controller = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error(`Przekroczono limit czasu przebiegu (${this.config.fetchDeadlineMs} ms)`));
      }, this.config.fetchDeadlineMs);
    });
    const work = this.runOnce(controller.signal, startedAt);
    work.catch(() => undefined);

    try {
      await Promise.race([work, deadline]);
      this.lastSuccessAt = new Date().toISOString();
      this.consecutiveFailures = 0;
    } catch (err) {
      this.lastFailureAt = new Date().toISOString();
      this.consecutiveFailures += 1;
      this.logger.error(
        { event: "fetch_failed", durationMs: Date.now() - startedAt, error: serializeError(err) },
        "Sprawdzanie skrzynki Librus nie powiodło się",
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private async runOnce(signal: AbortSignal, startedAt: number): Promise<void> {
    this.logger.info({ event: "fetch_started" }, "Start sprawdzania skrzynki Librus");

    const client = new LibrusClient(this.config);
    await client.login();
    this.logger.info({ event: "login_succeeded" }, "Zalogowano do Librusa");

    const state = await this.stateStore.load();
    const folderStates: Record<string, FolderState> = { ...(state?.folders ?? {}) };
    let totalNew = 0;
    let failedMessages = 0;

    for (const folderId of this.config.folderIds) {
      signal.throwIfAborted();
      const key = String(folderId);
      const messages = await client.listMessages(folderId);
      this.logger.info(
        { event: "folder_listed", folderId, count: messages.length },
        `Folder ${folderId}: pobrano listę ${messages.length} wiadomości`,
      );

      const existing = folderStates[key];
      if (!existing) {
        const sorted = [...messages].sort((a, b) => a.date.getTime() - b.date.getTime());
        const newest = sorted.at(-1);
        if (newest) {
          folderStates[key] = { lastMessageId: newest.id, lastMessageDate: newest.date.toISOString() };
          await this.stateStore.save({ folders: folderStates, updatedAt: new Date().toISOString() });
        }
        this.logger.info(
          { event: "bootstrap_completed", folderId, baselineMessageId: newest?.id ?? null },
          `Folder ${folderId}: brak wcześniejszego stanu - ustawiono punkt startowy, historia nie zostanie wysłana`,
        );
        continue;
      }

      const newMessages = selectNewMessages(messages, existing);
      this.logger.info(
        {
          event: "new_messages_detected",
          folderId,
          count: newMessages.length,
          ids: newMessages.map((m) => m.id),
        },
        `Folder ${folderId}: nowych wiadomości: ${newMessages.length}`,
      );
      totalNew += newMessages.length;

      for (const summary of newMessages) {
        const ok = await this.processMessage(client, folderId, key, summary, folderStates, signal);
        if (!ok) {
          // Zachowujemy kolejność: nie wysyłamy nowszych wiadomości przed tą, która jeszcze się ponawia.
          failedMessages += 1;
          break;
        }
      }
    }

    if (failedMessages > 0) {
      throw new Error(`Nie udało się przetworzyć wiadomości w ${failedMessages} folderze(ach), ponowię przy kolejnym wywołaniu`);
    }

    this.logger.info(
      { event: "fetch_finished", durationMs: Date.now() - startedAt, newMessages: totalNew },
      "Zakończono sprawdzanie skrzynki",
    );
  }
  // Zwraca false, gdy wiadomość się nie powiodła i będzie ponawiana; true, gdy przetworzona lub
  // porzucona po MAX_MESSAGE_ATTEMPTS (żeby jedna "zatruta" wiadomość nie blokowała kolejki).
  private async processMessage(
    client: LibrusClient,
    folderId: number,
    key: string,
    summary: MessageSummary,
    folderStates: Record<string, FolderState>,
    signal: AbortSignal,
  ): Promise<boolean> {
    const folder = folderStates[key]!;
    const inFlight: InFlight =
      folder.inFlight?.messageId === summary.id
        ? { ...folder.inFlight, delivered: [...folder.inFlight.delivered] }
        : { messageId: summary.id, attempts: 0, delivered: [] };

    const persist = async (next: FolderState): Promise<void> => {
      folderStates[key] = next;
      await this.stateStore.save({ folders: folderStates, updatedAt: new Date().toISOString() });
    };

    try {
      signal.throwIfAborted();
      const rawDetail = await client.getMessageDetail(folderId, summary.id);
      // W folderze "Wysłane" librus-api zwraca puste detail.sender (parsuje je tylko gdy
      // nagłówek strony to "Nadawca", a dla wysłanych jest "Adresat") - lista (listMessages)
      // ma tę nazwę poprawnie, więc używamy jej jako fallbacku.
      const detail = rawDetail.sender ? rawDetail : { ...rawDetail, sender: summary.sender };
      this.logger.info(
        {
          event: "message_fetched",
          folderId,
          messageId: detail.id,
          sender: detail.sender,
          subject: detail.subject,
          date: detail.date.toISOString(),
        },
        `Folder ${folderId}: pobrano treść wiadomości ${detail.id}`,
      );

      signal.throwIfAborted();
      await this.archiver.archive(detail);

      for (const notifier of this.notifiers) {
        if (inFlight.delivered.includes(notifier.name)) continue;
        signal.throwIfAborted();
        await notifier.notify({
          id: detail.id,
          date: detail.date,
          sender: detail.sender,
          subject: detail.subject,
          content: detail.content,
        });
        // Zapis po każdym udanym notifierze: ponowienie nie wyśle drugi raz tam, gdzie już poszło.
        inFlight.delivered.push(notifier.name);
        await persist({ ...folder, inFlight });
      }

      signal.throwIfAborted();
      await persist({ lastMessageId: detail.id, lastMessageDate: detail.date.toISOString() });
      return true;
    } catch (err) {
      if (signal.aborted) throw err;

      inFlight.attempts += 1;
      const giveUp = inFlight.attempts >= MAX_MESSAGE_ATTEMPTS;
      this.logger.error(
        {
          event: giveUp ? "message_skipped" : "message_failed",
          folderId,
          messageId: summary.id,
          attempts: inFlight.attempts,
          error: serializeError(err),
        },
        giveUp
          ? `Folder ${folderId}: wiadomość ${summary.id} pominięta po ${inFlight.attempts} nieudanych próbach`
          : `Folder ${folderId}: wiadomość ${summary.id} nie powiodła się (próba ${inFlight.attempts}/${MAX_MESSAGE_ATTEMPTS})`,
      );
      if (giveUp) {
        await persist({ lastMessageId: summary.id, lastMessageDate: summary.date.toISOString() });
        return true;
      }
      await persist({ ...folder, inFlight });
      return false;
    }
  }
}

function selectNewMessages(messages: MessageSummary[], state: FolderState): MessageSummary[] {
  const sorted = [...messages].sort((a, b) => a.date.getTime() - b.date.getTime());
  const lastDate = new Date(state.lastMessageDate).getTime();
  return sorted.filter((m) => {
    const time = m.date.getTime();
    if (time > lastDate) return true;
    if (time === lastDate && m.id > state.lastMessageId) return true;
    return false;
  });
}

function serializeError(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack };
  }
  return { message: String(err) };
}
