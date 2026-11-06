// Any wall-clock time, or the end-of-day `24:00`. The contracts' five-minute rule is the backend's to
// enforce, so it isn't repeated here.
const CLINIC_TIME = /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/;

/** Returns a wall-clock time exactly as sent, or `null` if it isn't one. It's never converted. */
export function readClinicTime(
  value: string | null | undefined,
): string | null {
  return value != null && CLINIC_TIME.test(value) ? value : null;
}
