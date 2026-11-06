import type { Schedule } from "./types";

/** A schedule can be saved with no periods at all, so a length alone doesn't mean there are hours. */
export function hasPeriods(schedule: Schedule): boolean {
  return schedule.days.some(({ periods }) => periods.length > 0);
}
