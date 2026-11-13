import type { Logger } from "../logger.js";
import type { LibrusNotification, Notifier } from "./types.js";

export class StdoutNotifier implements Notifier {
  readonly name = "stdout";

  constructor(private readonly logger: Logger) {}

  async notify(message: LibrusNotification): Promise<void> {
    this.logger.info(
      {
        event: "message_notified",
        target: this.name,
        messageId: message.id,
        messageDate: message.date.toISOString(),
        sender: message.sender,
        subject: message.subject,
        content: message.content,
      },
      `Nowa wiadomość od ${message.sender}: ${message.subject}`,
    );
  }
}
