// Obserwowane w praniu formaty dat z Librusa: "RRRR-MM-DD GG:MM:SS" (lista wiadomości,
// szczegóły wiadomości) oraz "DD.MM.RRRR GG:MM" (spotykane w innych miejscach serwisu).
const ISO_LIKE_RE = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/;
const POLISH_RE = /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/;

export function parseLibrusDate(raw: string): Date {
  const trimmed = raw.trim();

  const iso = ISO_LIKE_RE.exec(trimmed);
  if (iso) {
    const [, year, month, day, hour, minute, second] = iso;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second ?? "0"),
    );
  }

  const pl = POLISH_RE.exec(trimmed);
  if (pl) {
    const [, day, month, year, hour, minute, second] = pl;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second ?? "0"),
    );
  }

  throw new Error(`Unrecognized Librus date format: "${raw}"`);
}
