// Any wall-clock time, or the end-of-day `24:00`. The contracts' five-minute rule is the backend's to
// enforce, so it isn't repeated here.
const CLINIC_TIME = /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/;

/**
 * A clock time from minutes after midnight, as the audit trail keeps appointment times: `540` is `09:00`, and
 * `1440` is the end of the day, `24:00`. Anything that isn't a whole number in that range is `null`.
 */
export function minutesToClockTime(minutes: unknown): string | null {
  if (
    typeof minutes !== "number" ||
    !Number.isInteger(minutes) ||
    minutes < 0 ||
    minutes > 1440
  ) {
    return null;
  }
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** Returns a wall-clock time exactly as sent, or `null` if it isn't one. It's never converted. */
export function readClinicTime(
  value: string | null | undefined,
): string | null {
  return value != null && CLINIC_TIME.test(value) ? value : null;
}
