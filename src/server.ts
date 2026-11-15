import { timingSafeEqual } from "node:crypto";
import Fastify from "fastify";
import type { AppConfig } from "./config.js";
import type { Logger } from "./logger.js";
import type { FetchJob } from "./fetchJob.js";

export function buildServer(config: AppConfig, logger: Logger, fetchJob: FetchJob) {
  const app = Fastify({ loggerInstance: logger });

  // Zawsze 200 (restart poda nie naprawi błędnego hasła ani awarii Librusa), ale "degraded" +
  // statystyki pozwalają monitoringowi zauważyć kolejne nieudane przebiegi.
  app.get("/healthz", { logLevel: "silent" }, async () => {
    const status = fetchJob.getStatus();
    return { status: status.consecutiveFailures > 0 ? "degraded" : "ok", ...status };
  });

  app.post<{ Params: { secret: string } }>("/fetch/:secret", async (request, reply) => {
    if (!isValidSecret(request.params.secret, config.fetchSecret)) {
      return reply.code(404).send();
    }
    fetchJob.trigger();
    return reply.code(202).send({ status: "accepted" });
  });

  return app;
}

function isValidSecret(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
