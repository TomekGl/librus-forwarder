import type { Logger } from "../logger.js";
import type { LibrusNotification, Notifier } from "./types.js";

const MAX_BODY_LENGTH = 3500;

export class SlackNotifier implements Notifier {
  readonly name = "slack";

  constructor(
    private readonly webhookUrl: string,
    private readonly logger: Logger,
  ) {}

  async notify(message: LibrusNotification): Promise<void> {
    const text =
      `Nowa wiadomość od ${escapeMrkdwn(message.sender)} o ${formatDate(message.date)}\n\n` +
      truncate(escapeMrkdwn(message.content), MAX_BODY_LENGTH);

    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Slack webhook responded with ${response.status}: ${body}`);
    }

    this.logger.info(
      { event: "message_notified", target: this.name, messageId: message.id },
      `Wysłano powiadomienie Slack o wiadomości ${message.id}`,
    );
  }
}

function formatDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function escapeMrkdwn(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}… (treść obcięta)`;
}
