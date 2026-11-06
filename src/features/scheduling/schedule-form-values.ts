import { DAYS, type Day, type Schedule } from "./types";

export type PeriodRow = { day: Day; start: string; end: string };

export type ScheduleFormInput = {
  appointment_minutes: string;
  periods: PeriodRow[];
};

export function scheduleToFormValues(schedule: Schedule): ScheduleFormInput {
  return {
    appointment_minutes:
      schedule.appointment_minutes === null
        ? ""
        : String(schedule.appointment_minutes),
    periods: schedule.days.flatMap(({ day, periods }) =>
      periods.map(({ start, end }) => ({ day, start, end })),
    ),
  };
}

/**
 * Where a new row goes, so that the list stays in screen order. The API reports problems by the index it
 * received (`periods.N`), so sending rows in this order is what leads an error back to its row.
 */
export function insertionIndex(
  rows: readonly { day: Day }[],
  day: Day,
): number {
  const order: readonly Day[] = DAYS;
  const position = order.indexOf(day);
  const next = rows.findIndex((row) => order.indexOf(row.day) > position);
  return next === -1 ? rows.length : next;
}
