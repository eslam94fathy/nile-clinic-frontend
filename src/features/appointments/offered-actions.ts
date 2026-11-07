import type { AppointmentStatus } from "./types";

export type AppointmentAction =
  "check_in" | "reschedule" | "cancel" | "no_show";

/**
 * What to offer. This only decides what's shown, as quick feedback, and the API's answer wins. "Started" is
 * the same comparison as the backend's `Appointment::hasStarted`, on clinic wall-clock values as strings.
 * A patient can check in at any time on the day, before or after the start.
 */
export function offeredActions(
  status: AppointmentStatus,
  date: string,
  start: string,
  clinicNow: string,
): AppointmentAction[] {
  if (status !== "scheduled") return [];

  const changes: AppointmentAction[] =
    `${date} ${start}` <= clinicNow ? ["no_show"] : ["reschedule", "cancel"];

  return clinicNow.startsWith(`${date} `) ? ["check_in", ...changes] : changes;
}
