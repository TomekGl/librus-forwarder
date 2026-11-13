import pino from "pino";
import type { AppConfig } from "./config.js";

export function createLogger(config: AppConfig) {
  return pino({
    level: config.logLevel,
    transport: config.logPretty
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard" } }
      : undefined,
  });
}

export type Logger = ReturnType<typeof createLogger>;
