declare module "librus-api" {
  export interface LibrusInboxRow {
    id: number;
    user: string;
    title: string;
    date: string;
    read: boolean;
  }

  export interface LibrusMessageRow extends LibrusInboxRow {
    url: string;
    folderId: number;
    content: string;
    html: string;
    files: Array<{ name: string; path: string }>;
  }

  export default class Librus {
    constructor(cookies?: unknown, options?: { requestTimeout?: number });
    authorize(login: string, pass: string): Promise<void>;
    inbox: {
      listInbox(folderId: number): Promise<LibrusInboxRow[]>;
      getMessage(folderId: number, messageId: number): Promise<LibrusMessageRow>;
    };
  }
}
