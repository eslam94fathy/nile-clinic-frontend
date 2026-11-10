/**
 * The date in the clinic's time zone, for default ranges. It's a convenience, as the API remains the
 * authority on what today is (hazard H4).
 */
export function clinicToday(timeZone: string, now: Date = new Date()): string {
  // `en-CA` writes a date as YYYY-MM-DD, whatever the application's language.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Adds days to a clinic date, working in UTC so that no local daylight-saving change can shift it. */
export function addDays(date: string, count: number): string {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + count))
    .toISOString()
    .slice(0, 10);
}

/** The first day of a clinic date's month. */
export function startOfMonth(date: string): string {
  return `${date.slice(0, 8)}01`;
}

/** The last day of the month before a clinic date's month. */
export function endOfPreviousMonth(date: string): string {
  return addDays(startOfMonth(date), -1);
}
