/**
 * Formats a moment in time for display in the clinic's time zone, never the browser's.
 * Arabic numeral style is decided in Phase 2.
 */
export function formatInstant(
  instant: Date,
  locale: string,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(instant);
}
