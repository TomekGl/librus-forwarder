import type { AppConfig } from "./config.js";
import type { Logger } from "./logger.js";
import { LibrusClient, type MessageSummary } from "./librus/client.js";
import { StateStore, type FetchState } from "./state/store.js";
import type { Notifier } from "./notifiers/types.js";

export class FetchJob {
  private running = false;
  private pending = false;

  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
    private readonly stateStore: StateStore,
    private readonly notifiers: Notifier[],
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
      const messages = await client.listInboxMessages();
      this.logger.info(
        { event: "inbox_listed", count: messages.length },
        `Pobrano listę ${messages.length} wiadomości`,
      );

      let newMessages: MessageSummary[];
      if (!state) {
        newMessages = [];
        const sorted = [...messages].sort((a, b) => a.date.getTime() - b.date.getTime());
        const newest = sorted.at(-1);
        if (newest) {
          await this.stateStore.save({
            lastMessageId: newest.id,
            lastMessageDate: newest.date.toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
        this.logger.info(
          { event: "bootstrap_completed", baselineMessageId: newest?.id ?? null },
          "Brak wcześniejszego stanu - ustawiono punkt startowy, historia nie zostanie wysłana",
        );
      } else {
        newMessages = selectNewMessages(messages, state);
        this.logger.info(
          { event: "new_messages_detected", count: newMessages.length, ids: newMessages.map((m) => m.id) },
          `Nowych wiadomości: ${newMessages.length}`,
        );
      }

      for (const summary of newMessages) {
        const detail = await client.getMessageDetail(summary.id);
        this.logger.info(
          {
            event: "message_fetched",
            messageId: detail.id,
            sender: detail.sender,
            subject: detail.subject,
            date: detail.date.toISOString(),
          },
          `Pobrano treść wiadomości ${detail.id}`,
        );

        for (const notifier of this.notifiers) {
          await notifier.notify({
            id: detail.id,
            date: detail.date,
            sender: detail.sender,
            subject: detail.subject,
            content: detail.content,
          });
        }

        await this.stateStore.save({
          lastMessageId: detail.id,
          lastMessageDate: detail.date.toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      this.logger.info(
        { event: "fetch_finished", durationMs: Date.now() - startedAt, newMessages: newMessages.length },
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

function selectNewMessages(messages: MessageSummary[], state: FetchState): MessageSummary[] {
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
