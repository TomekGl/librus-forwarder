import { promises as fs } from "node:fs";
import path from "node:path";
import type { Logger } from "../logger.js";

export interface FetchState {
  lastMessageId: number;
  lastMessageDate: string;
  updatedAt: string;
}

export class StateStore {
  constructor(
    private readonly filePath: string,
    private readonly logger: Logger,
  ) {}

  async load(): Promise<FetchState | null> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      return JSON.parse(raw) as FetchState;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        this.logger.info(
          { event: "state_missing", path: this.filePath },
          "Brak zapisanego stanu, startuję od zera",
        );
      } else {
        this.logger.warn(
          { event: "state_corrupt", path: this.filePath, error: String(err) },
          "Nie udało się odczytać stanu, startuję od zera",
        );
      }
      return null;
    }
  }

  async save(state: FetchState): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(state, null, 2), "utf8");
    await fs.rename(tmpPath, this.filePath);
  }
}
