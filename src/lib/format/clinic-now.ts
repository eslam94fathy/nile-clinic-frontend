import { clinicToday } from "./clinic-today";

/**
 * The clinic's date and time as `YYYY-MM-DD HH:mm`, to compare with a clinic date and wall-clock time as
 * strings. A convenience for what to offer, as the API remains the authority (hazard H4).
 */
export function clinicNow(timeZone: string, now: Date = new Date()): string {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return `${clinicToday(timeZone, now)} ${time}`;
}
