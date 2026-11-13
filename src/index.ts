import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { buildNotifiers } from "./notifiers/index.js";
import { StateStore } from "./state/store.js";
import { FetchJob } from "./fetchJob.js";
import { buildServer } from "./server.js";

const config = loadConfig();
const logger = createLogger(config);
const notifiers = buildNotifiers(config, logger);
const stateStore = new StateStore(config.stateFilePath, logger);
const fetchJob = new FetchJob(config, logger, stateStore, notifiers);
const app = buildServer(config, logger, fetchJob);

app
  .listen({ host: "0.0.0.0", port: config.port })
  .then(() => {
    logger.info(
      { event: "server_started", port: config.port, notifyTargets: config.notifyTargets },
      `librus-forwarder nasłuchuje na porcie ${config.port}`,
    );
  })
  .catch((err: unknown) => {
    logger.error({ event: "server_start_failed", error: String(err) }, "Nie udało się wystartować serwera");
    process.exit(1);
  });
