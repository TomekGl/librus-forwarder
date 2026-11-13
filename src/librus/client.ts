import Librus from "librus-api";
import type { AppConfig } from "../config.js";
import { parseLibrusDate } from "./date.js";

export interface MessageSummary {
  id: number;
  folderId: number;
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

  async listMessages(folderId: number): Promise<MessageSummary[]> {
    const rows = await this.raw.inbox.listInbox(folderId);
    return rows.map((row) => ({
      id: row.id,
      folderId,
      sender: row.user,
      subject: row.title,
      date: parseLibrusDate(row.date),
      read: row.read,
    }));
  }

  async getMessageDetail(folderId: number, messageId: number): Promise<MessageDetail> {
    const detail = await this.raw.inbox.getMessage(folderId, messageId);
    return {
      id: messageId,
      folderId,
      sender: detail.user,
      subject: detail.title,
      date: parseLibrusDate(detail.date),
      read: detail.read,
      content: detail.content,
    };
  }
}
