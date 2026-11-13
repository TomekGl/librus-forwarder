import { promises as fs } from "node:fs";
import path from "node:path";
import type { Logger } from "../logger.js";
import type { MessageDetail } from "../librus/client.js";

// Jeden plik na wiadomość (nie jeden plik na miesiąc): treść Librusa jest HTML-em o
// zmiennej długości, więc dopisywanie wielu wiadomości do wspólnego pliku miesięcznego
// wymagałoby bezpiecznego escapowania/delimitera i nie dałoby atomowości zapisu. Plik per
// wiadomość jest trywialnie atomowy (tmp+rename, jak state/store.ts) i idempotentny przy
// ponownym pobraniu tej samej wiadomości.
export class MessageArchiver {
  constructor(
    private readonly archiveDir: string,
    private readonly logger: Logger,
  ) {}

  async archive(message: MessageDetail): Promise<string> {
    const monthDir = path.join(this.archiveDir, formatMonth(message.date));
    await fs.mkdir(monthDir, { recursive: true });

    const filePath = path.join(monthDir, `${formatTimestamp(message.date)}_${message.id}.json`);
    const tmpPath = `${filePath}.tmp`;
    const payload = {
      id: message.id,
      date: message.date.toISOString(),
      sender: message.sender,
      subject: message.subject,
      content: message.content,
    };
    await fs.writeFile(tmpPath, JSON.stringify(payload, null, 2), "utf8");
    await fs.rename(tmpPath, filePath);

    this.logger.info(
      { event: "message_archived", messageId: message.id, path: filePath },
      `Zarchiwizowano wiadomość ${message.id} do ${filePath}`,
    );

    return filePath;
  }
}

function formatMonth(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  );
}
