export interface LibrusNotification {
  id: number;
  date: Date;
  sender: string;
  subject: string;
  content: string;
}

export interface Notifier {
  readonly name: string;
  notify(message: LibrusNotification): Promise<void>;
}
