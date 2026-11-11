import type { AuditAction } from "./types";

export type ActionGroup =
  | "auth"
  | "staff"
  | "patients"
  | "specialties"
  | "doctors"
  | "appointments"
  | "visits"
  | "records"
  | "money"
  | "audit";

/** The action choice's groups, in the order shown (research R8). Each action is in exactly one, as a test checks. */
export const ACTION_GROUPS: readonly {
  group: ActionGroup;
  actions: readonly AuditAction[];
}[] = [
  {
    group: "auth",
    actions: ["auth.sign_in", "auth.sign_out", "auth.password_changed"],
  },
  {
    group: "staff",
    actions: [
      "staff.created",
      "staff.updated",
      "staff.deactivated",
      "staff.reactivated",
      "staff.password_reset",
    ],
  },
  {
    group: "patients",
    actions: ["patient.registered", "patient.updated", "patient.opened"],
  },
  {
    group: "specialties",
    actions: [
      "specialty.created",
      "specialty.updated",
      "specialty.deactivated",
      "specialty.reactivated",
    ],
  },
  {
    group: "doctors",
    actions: [
      "doctor.created",
      "doctor.updated",
      "schedule.set",
      "schedule.cleared",
      "time_off.added",
      "time_off.removed",
      "fee.set",
    ],
  },
  {
    group: "appointments",
    actions: [
      "appointment.booked",
      "appointment.rescheduled",
      "appointment.cancelled",
      "appointment.no_show",
    ],
  },
  {
    group: "visits",
    actions: [
      "visit.checked_in",
      "visit.walk_in_added",
      "visit.left",
      "visit.check_in_undone",
      "visit.called",
      "visit.finished",
    ],
  },
  {
    group: "records",
    actions: [
      "encounter.started",
      "encounter.draft_saved",
      "encounter.finalized",
      "encounter.addendum_added",
      "encounter.opened",
      "encounter.history_viewed",
    ],
  },
  {
    group: "money",
    actions: [
      "charge.created",
      "payment.recorded",
      "refund.recorded",
      "discount.set",
      "charge.cancelled",
    ],
  },
  { group: "audit", actions: ["audit.searched"] },
];

const ACTIONS = new Set<string>(
  ACTION_GROUPS.flatMap(({ actions }) => actions),
);

export const isAuditAction = (value: unknown): value is AuditAction =>
  typeof value === "string" && ACTIONS.has(value);
