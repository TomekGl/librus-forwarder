import Librus from "librus-api";
import type { AppConfig } from "../config.js";
import { parseLibrusDate } from "./date.js";

export interface MessageSummary {
  id: number;
  sender: string;
  subject: string;
  date: Date;
  read: boolean;
}

export interface MessageDetail extends MessageSummary {
  content: string;
}

export class LibrusClient {
  private readonly raw: Librus;

  constructor(private readonly config: AppConfig) {
    this.raw = new Librus(undefined, { requestTimeout: config.requestTimeoutMs });
  }

  async login(): Promise<void> {
    await this.raw.authorize(this.config.librusLogin, this.config.librusPassword);
  }

  async listInboxMessages(): Promise<MessageSummary[]> {
    const rows = await this.raw.inbox.listInbox(this.config.inboxFolderId);
    return rows.map((row) => ({
      id: row.id,
      sender: row.user,
      subject: row.title,
      date: parseLibrusDate(row.date),
      read: row.read,
    }));
  }

  async getMessageDetail(messageId: number): Promise<MessageDetail> {
    const detail = await this.raw.inbox.getMessage(this.config.inboxFolderId, messageId);
    return {
      id: messageId,
      sender: detail.user,
      subject: detail.title,
      date: parseLibrusDate(detail.date),
      read: detail.read,
      content: detail.content,
    };
  }
}
