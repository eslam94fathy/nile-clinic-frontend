import { z } from "zod";
import {
  CHARGE_STATUSES,
  type Charge,
  type ChargeSummary,
  PAYMENT_METHODS,
  type VisitCharge,
  VISIT_CHARGE_STATUSES,
} from "../types";

// The contract's `Money`: text with exactly two decimals, never a number (constitution V).
const money = z.string().regex(/^\d+\.\d{2}$/);
const doctor = z.object({
  id: z.number(),
  name: z.string(),
  title: z.string(),
});
const patient = z.object({
  id: z.number(),
  full_name: z.string(),
  phone: z.string(),
});
const staff = z.object({ id: z.number(), name: z.string() });
const method = z.enum(PAYMENT_METHODS);

export const visitChargeSchema = z.object({
  id: z.number(),
  date: z.string(),
  status: z.enum(["waiting", "with_doctor", "seen", "left"]),
  walk_in: z.boolean(),
  doctor,
  patient,
  charge_status: z.enum(VISIT_CHARGE_STATUSES),
  charge_id: z.number().nullable(),
  balance: money.nullable(),
}) satisfies z.ZodType<VisitCharge>;

const summaryFields = {
  id: z.number(),
  visit_id: z.number().nullable(),
  status: z.enum(CHARGE_STATUSES),
  date: z.string(),
  doctor,
  patient,
  fee: money,
  discount: money,
  amount_due: money,
  amount_paid: money,
  balance: money,
  charged_at: z.string(),
};

export const chargeSummarySchema = z.object(
  summaryFields,
) satisfies z.ZodType<ChargeSummary>;

export const chargeSchema = z.object({
  ...summaryFields,
  charged_by: staff,
  discount_reason: z.string().nullable(),
  discounted_by: staff.nullable(),
  discounted_at: z.string().nullable(),
  cancel_reason: z.string().nullable(),
  cancelled_by: staff.nullable(),
  cancelled_at: z.string().nullable(),
  payments: z.array(
    z.object({
      id: z.number(),
      amount: money,
      method,
      received_by: staff,
      received_at: z.string(),
    }),
  ),
  refunds: z.array(
    z.object({
      id: z.number(),
      amount: money,
      method,
      reason: z.string(),
      refunded_by: staff,
      refunded_at: z.string(),
    }),
  ),
}) satisfies z.ZodType<Charge>;
