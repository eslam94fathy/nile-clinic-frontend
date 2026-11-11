import type { components as Appointments } from "@/lib/api/generated/appointments";
import type { components as Queues } from "@/lib/api/generated/queues";
import type { components as Reports } from "@/lib/api/generated/reports";

type AppointmentSummary = Appointments["schemas"]["AppointmentSummary"];
type OwnAppointmentSummary = Appointments["schemas"]["OwnAppointmentSummary"];
type OwnQueueEntry = Queues["schemas"]["OwnQueueEntry"];
type MoneyFigures = Reports["schemas"]["MoneyFigures"];
type ActivityFigures = Reports["schemas"]["ActivityFigures"];

// Only the fields a dashboard shows. A list's phone, sex, and date of birth are dropped when the body is checked.

/** A list's `meta.total`, read with one row. */
export type Count = number;

/** One page of five, and how many there are in all. */
export type ShortList<Row> = { rows: Row[]; total: number };

export type AppointmentRow = Pick<
  AppointmentSummary,
  "id" | "date" | "start" | "end"
> & {
  patient: Pick<AppointmentSummary["patient"], "full_name">;
  doctor: Pick<AppointmentSummary["doctor"], "name" | "title">;
};

export type OwnAppointmentRow = Pick<
  OwnAppointmentSummary,
  "id" | "date" | "start" | "end"
> & { patient: Pick<OwnAppointmentSummary["patient"], "full_name"> };

/** The status stays a string, so that one the frontend doesn't know is shown as sent rather than failing the panel. */
export type OwnQueueRow = Pick<
  OwnQueueEntry,
  "id" | "queue_number" | "called_at"
> & {
  status: string;
  patient: Pick<OwnQueueEntry["patient"], "full_name">;
};

/** As for the queue's status: a method the frontend doesn't know is shown as sent. */
export type MethodFigures = MoneyFigures & { method: string };

export type MoneyToday = { totals: MoneyFigures; by_method: MethodFigures[] };

export type ActivityTotals = ActivityFigures & { new_patients?: number };

// Each panel's data. `today` is the clinic's date the read was made for.

export type TodaysAppointments = {
  today: string;
  toArrive: ShortList<AppointmentRow>;
  arrived: Count;
  completed: Count;
  noShow: Count;
};

export type QueueByStatus = {
  waiting: Count;
  withDoctor: Count;
  seen: Count;
  ["left"]: Count;
};

export type MoneyOwed = {
  today: string;
  notCharged: Count;
  unpaid: Count;
  partlyPaid: Count;
};

export type NeedingAMove = {
  from: string;
  to: string;
  list: ShortList<AppointmentRow>;
};

export type OwnQueue = { current: OwnQueueRow | null; waiting: OwnQueueRow[] };

export type NextOwnAppointments = ShortList<OwnAppointmentRow>;

export type OwnRecords = {
  from: string;
  to: string;
  none: Count;
  draft: Count;
};

export type MoneyTodayPanel = { today: string; money: MoneyToday };

export type ActivityTodayPanel = { today: string; totals: ActivityTotals };
