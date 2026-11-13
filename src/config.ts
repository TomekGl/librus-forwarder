export interface AppConfig {
  port: number;
  fetchSecret: string;
  librusLogin: string;
  librusPassword: string;
  notifyTargets: string[];
  slackWebhookUrl?: string;
  stateFilePath: string;
  messageArchiveDir: string;
  inboxFolderId: number;
  logLevel: string;
  logPretty: boolean;
  requestTimeoutMs: number;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function loadConfig(): AppConfig {
  const notifyTargets = (process.env.NOTIFY_TARGETS ?? "stdout")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  if (notifyTargets.length === 0) {
    throw new Error("NOTIFY_TARGETS must list at least one target");
  }
  if (notifyTargets.includes("slack") && !process.env.SLACK_WEBHOOK_URL) {
    throw new Error('NOTIFY_TARGETS includes "slack" but SLACK_WEBHOOK_URL is not set');
  }

  return {
    port: Number(process.env.PORT ?? 8080),
    fetchSecret: required("FETCH_SECRET"),
    librusLogin: required("LIBRUS_LOGIN"),
    librusPassword: required("LIBRUS_PASSWORD"),
    notifyTargets,
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
    stateFilePath: process.env.STATE_FILE_PATH ?? "/data/state.json",
    messageArchiveDir: process.env.MESSAGE_ARCHIVE_DIR ?? "/data/archive",
    inboxFolderId: Number(process.env.LIBRUS_INBOX_FOLDER_ID ?? 5),
    logLevel: process.env.LOG_LEVEL ?? "info",
    logPretty: process.env.LOG_PRETTY === "true",
    requestTimeoutMs: Number(process.env.LIBRUS_REQUEST_TIMEOUT_MS ?? 30000),
  };
}
