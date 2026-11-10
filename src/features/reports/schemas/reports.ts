import { z } from "zod";
import { pageSchema } from "@/lib/api/pagination";
import type {
  ActivityFigures,
  ActivityRow,
  ActivityTotals,
  BillingFigures,
  BillingRow,
  MoneyCollected,
  ReportDoctor,
  ReportPage,
  TimesFigures,
  TimesRow,
} from "../types";

// The contract's `Money` and `SignedMoney`: text with exactly two decimals, never a number (constitution V).
const money = z.string().regex(/^\d+\.\d{2}$/);
const signedMoney = z.string().regex(/^-?\d+\.\d{2}$/);
const count = z.number().int().min(0);

const doctor = z.object({
  id: z.number(),
  name: z.string(),
  title: z.string().nullable(),
}) satisfies z.ZodType<ReportDoctor>;

const moneyFigures = {
  received: money,
  refunded: money,
  net: signedMoney,
};

export const moneyCollectedSchema = z.object({
  data: z.object({
    from: z.string(),
    to: z.string(),
    totals: z.object(moneyFigures),
    by_method: z.array(
      z.object({
        ...moneyFigures,
        method: z.enum(["cash", "card", "wallet"]),
        staff: z.array(
          z.object({ ...moneyFigures, id: z.number(), name: z.string() }),
        ),
      }),
    ),
    by_day: z.array(z.object({ ...moneyFigures, date: z.string() })),
  }) satisfies z.ZodType<MoneyCollected>,
});

const billingFigures = z.object({
  active_charges: count,
  fees: money,
  discounts: money,
  amount_due: money,
  amount_paid: money,
  balance: money,
  cancelled_charges: count,
  uncharged_seen_visits: count,
}) satisfies z.ZodType<BillingFigures>;

const activityFigures = z.object({
  appointments: z.object({
    scheduled: count,
    cancelled: count,
    no_show: count,
    checked_in: count,
    completed: count,
  }),
  no_show_rate: z.number().nullable(),
  visits: z.object({
    waiting: count,
    with_doctor: count,
    seen: count,
    // The backend's status, not a position. Computed, so the logical-styles check can stay strict.
    ["left"]: count,
    booked: count,
    walk_in: count,
  }),
}) satisfies z.ZodType<ActivityFigures>;

const averageTime = z.object({
  average_minutes: z.number().int().nullable(),
  visits: count,
});

const timesFigures = z.object({
  wait: averageTime,
  consultation: averageTime,
  records: z.object({ finalized: count, draft: count, none: count }),
}) satisfies z.ZodType<TimesFigures>;

/** A standard page plus the API's `totals`, which cover every doctor. */
function reportPageSchema<Row extends z.ZodType, Totals extends z.ZodType>(
  row: Row,
  totals: Totals,
) {
  return pageSchema(row).extend({ totals });
}

export const billingPageSchema = reportPageSchema(
  billingFigures.extend({ doctor }),
  billingFigures,
) satisfies z.ZodType<ReportPage<BillingRow, BillingFigures>>;

export const activityPageSchema = reportPageSchema(
  activityFigures.extend({ doctor }),
  // Absent, not zero, when a doctor is chosen.
  activityFigures.extend({ new_patients: count.optional() }),
) satisfies z.ZodType<ReportPage<ActivityRow, ActivityTotals>>;

export const timesPageSchema = reportPageSchema(
  timesFigures.extend({ doctor }),
  timesFigures,
) satisfies z.ZodType<ReportPage<TimesRow, TimesFigures>>;
