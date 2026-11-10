import type { components } from "@/lib/api/generated/payments";

type Schemas = components["schemas"];

export type VisitCharge = Schemas["VisitCharge"];
export type ChargeSummary = Schemas["ChargeSummary"];
export type Charge = Schemas["Charge"];
export type Payment = Schemas["Payment"];
export type Refund = Schemas["Refund"];
export type ChargeStatus = Schemas["ChargeStatus"];
export type PaymentMethod = Schemas["PaymentMethod"];
export type VisitChargeStatus = VisitCharge["charge_status"];

export const CHARGE_STATUSES = [
  "unpaid",
  "partially_paid",
  "paid",
  "cancelled",
] as const satisfies readonly ChargeStatus[];

/** A visit's view of its active charge, where `none` means it has none. Never `cancelled`. */
export const VISIT_CHARGE_STATUSES = [
  "none",
  "unpaid",
  "partially_paid",
  "paid",
] as const satisfies readonly VisitChargeStatus[];

export const PAYMENT_METHODS = [
  "cash",
  "card",
  "wallet",
] as const satisfies readonly PaymentMethod[];

export type BillingFilters = {
  date: string;
  /** Whether `date` is the clinic's today, which decides whether the list reads by itself (ADR 0015). */
  isToday: boolean;
  doctorId: number | null;
  chargeStatus: VisitChargeStatus | null;
  page: number;
};

export type ChargeFilters = {
  from: string;
  to: string;
  patientId: number | null;
  doctorId: number | null;
  status: ChargeStatus | null;
  page: number;
  /** A range the API would refuse, so it isn't read at all (research R9). */
  rangeProblem: "too_long" | "reversed" | null;
  /**
   * The address names a patient by something that can't be a patient number. Nothing is read, as everyone's charges
   * under "Showing charges for this patient" would mislead.
   */
  patientProblem: boolean;
};
