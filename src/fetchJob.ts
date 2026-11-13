import type { AppConfig } from "./config.js";
import type { Logger } from "./logger.js";
import { LibrusClient, type MessageSummary } from "./librus/client.js";
import { StateStore, type FolderState } from "./state/store.js";
import type { Notifier } from "./notifiers/types.js";
import { MessageArchiver } from "./archive/messageArchiver.js";

export class FetchJob {
  private running = false;
  private pending = false;

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

  private async runLoop(): Promise<void> {
    this.running = true;
    do {
      this.pending = false;
      await this.runOnce();
    } while (this.pending);
    this.running = false;
  }

  private async runOnce(): Promise<void> {
    const startedAt = Date.now();
    this.logger.info({ event: "fetch_started" }, "Start sprawdzania skrzynki Librus");

    try {
      const client = new LibrusClient(this.config);
      await client.login();
      this.logger.info({ event: "login_succeeded" }, "Zalogowano do Librusa");

      const state = await this.stateStore.load();
      const folderStates: Record<string, FolderState> = { ...(state?.folders ?? {}) };
      let totalNew = 0;

      for (const folderId of this.config.folderIds) {
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

          await this.archiver.archive(detail);

          for (const notifier of this.notifiers) {
            await notifier.notify({
              id: detail.id,
              date: detail.date,
              sender: detail.sender,
              subject: detail.subject,
              content: detail.content,
            });
          }

          folderStates[key] = { lastMessageId: detail.id, lastMessageDate: detail.date.toISOString() };
          await this.stateStore.save({ folders: folderStates, updatedAt: new Date().toISOString() });
        }
      }

      this.logger.info(
        { event: "fetch_finished", durationMs: Date.now() - startedAt, newMessages: totalNew },
        "Zakończono sprawdzanie skrzynki",
      );
    } catch (err) {
      this.logger.error(
        { event: "fetch_failed", durationMs: Date.now() - startedAt, error: serializeError(err) },
        "Sprawdzanie skrzynki Librus nie powiodło się",
      );
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
