import type { AppConfig } from "../config.js";
import type { Logger } from "../logger.js";
import type { Notifier } from "./types.js";
import { StdoutNotifier } from "./stdout.js";

export function buildNotifiers(config: AppConfig, logger: Logger): Notifier[] {
  return config.notifyTargets.map((target) => {
    switch (target) {
      case "stdout":
        return new StdoutNotifier(logger);
      default:
        throw new Error(`Unknown notify target: "${target}". Supported: stdout`);
    }
  });
}
