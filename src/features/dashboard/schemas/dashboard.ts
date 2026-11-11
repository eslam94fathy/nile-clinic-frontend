import { z } from "zod";
import type {
  ActivityTotals,
  AppointmentRow,
  MoneyToday,
  OwnAppointmentRow,
  OwnQueueRow,
} from "../types";

// Narrow on purpose: an object schema drops keys it doesn't name, so a phone in a list never reaches the screen or the
// query cache. Each `satisfies` checks the fields kept against the generated contract types.

const total = z.number().int().nonnegative();

/** A read with one row, kept only for its total. */
export const countPageSchema = z.object({ meta: z.object({ total }) });

export function shortPageSchema<Row extends z.ZodType>(row: Row) {
  return z.object({ data: z.array(row), meta: z.object({ total }) });
}

export const appointmentRowSchema = z.object({
  id: z.number(),
  date: z.string(),
  start: z.string(),
  end: z.string(),
  patient: z.object({ full_name: z.string() }),
  doctor: z.object({ name: z.string(), title: z.string() }),
}) satisfies z.ZodType<AppointmentRow>;

export const ownAppointmentRowSchema = z.object({
  id: z.number(),
  date: z.string(),
  start: z.string(),
  end: z.string(),
  patient: z.object({ full_name: z.string() }),
}) satisfies z.ZodType<OwnAppointmentRow>;

export const ownQueueRowSchema = z.object({
  id: z.number(),
  queue_number: z.number(),
  status: z.string(),
  called_at: z.string().nullable(),
  patient: z.object({ full_name: z.string() }),
}) satisfies z.ZodType<OwnQueueRow>;

/** The doctor's whole list, which the API doesn't page. */
export const ownQueueSchema = z.object({ data: z.array(ownQueueRowSchema) });

// Money is text from the API to the screen, as the contract's `Money` and `SignedMoney` define it: exactly two decimals.
// Anything else, a number included, is a failed read, never converted or shown as a dash, as in Reports.
const money = z.string().regex(/^\d+\.\d{2}$/);
const moneyFigures = z.object({
  received: money,
  refunded: money,
  net: z.string().regex(/^-?\d+\.\d{2}$/),
});

export const moneyTodaySchema = z.object({
  data: z.object({
    totals: moneyFigures,
    by_method: z.array(moneyFigures.extend({ method: z.string() })),
  }) satisfies z.ZodType<MoneyToday>,
});

export const activityTotalsSchema = z.object({
  appointments: z.object({
    scheduled: total,
    cancelled: total,
    no_show: total,
    checked_in: total,
    completed: total,
  }),
  no_show_rate: z.number().nullable(),
  visits: z.object({
    waiting: total,
    with_doctor: total,
    seen: total,
    ["left"]: total,
    booked: total,
    walk_in: total,
  }),
  new_patients: total.optional(),
}) satisfies z.ZodType<ActivityTotals>;

/** Only the totals are used: they cover every doctor, whichever page of doctors is returned. */
export const activityPageSchema = z.object({ totals: activityTotalsSchema });
