import { readClinicDate } from "./clinic-date";
import { formattingLocale } from "./locale";

// The backend's two spellings: `2026-11-05T14:22:31+00:00` and `2026-11-05T14:22:31.000000Z`.
const INSTANT =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Reads a moment from the API, or returns `null` if it isn't one. Six fractional digits aren't in the
 * ECMAScript date format, so the fraction is cut to three before parsing.
 */
export function parseInstant(value: string | null | undefined): Date | null {
  const match = value == null ? null : INSTANT.exec(value);
  if (!match) return null;

  const [, dateTime = "", fraction = "", zone] = match;
  // Some engines roll an impossible day forward, which would show a plausible, wrong moment.
  if (readClinicDate(dateTime.slice(0, 10)) === null) return null;

  const date = new Date(
    `${dateTime}.${fraction.padEnd(3, "0").slice(0, 3)}${zone}`,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Formats a moment in time for display in the clinic's time zone, never the browser's. `seconds` is for the audit
 * trail, where entries a second apart must be told apart.
 */
export function formatInstant(
  instant: Date,
  locale: string,
  timeZone: string,
  { seconds = false }: { seconds?: boolean } = {},
): string {
  return new Intl.DateTimeFormat(formattingLocale(locale), {
    timeZone,
    dateStyle: "medium",
    timeStyle: seconds ? "medium" : "short",
  }).format(instant);
}
