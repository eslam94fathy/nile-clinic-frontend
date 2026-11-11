import { describe, expect, it } from "vitest";
import { ACTION_GROUPS, isAuditAction } from "./action-groups";
import type { AuditAction } from "./types";

// Every value the contract defines. `satisfies` fails type checking if one is added or removed there.
const ALL = {
  "auth.sign_in": true,
  "auth.sign_out": true,
  "auth.password_changed": true,
  "staff.created": true,
  "staff.updated": true,
  "staff.deactivated": true,
  "staff.reactivated": true,
  "staff.password_reset": true,
  "patient.registered": true,
  "patient.updated": true,
  "patient.opened": true,
  "specialty.created": true,
  "specialty.updated": true,
  "specialty.deactivated": true,
  "specialty.reactivated": true,
  "doctor.created": true,
  "doctor.updated": true,
  "schedule.set": true,
  "schedule.cleared": true,
  "time_off.added": true,
  "time_off.removed": true,
  "appointment.booked": true,
  "appointment.rescheduled": true,
  "appointment.cancelled": true,
  "appointment.no_show": true,
  "visit.checked_in": true,
  "visit.walk_in_added": true,
  "visit.left": true,
  "visit.check_in_undone": true,
  "visit.called": true,
  "visit.finished": true,
  "encounter.started": true,
  "encounter.draft_saved": true,
  "encounter.finalized": true,
  "encounter.addendum_added": true,
  "encounter.opened": true,
  "encounter.history_viewed": true,
  "fee.set": true,
  "charge.created": true,
  "payment.recorded": true,
  "refund.recorded": true,
  "discount.set": true,
  "charge.cancelled": true,
  "audit.searched": true,
} satisfies Record<AuditAction, true>;

describe("ACTION_GROUPS", () => {
  const grouped = ACTION_GROUPS.flatMap(({ actions }) => actions);

  it("holds each of the 44 actions exactly once", () => {
    expect(grouped).toHaveLength(44);
    expect(new Set(grouped).size).toBe(44);
    expect([...grouped].sort()).toEqual(Object.keys(ALL).sort());
  });

  it("has the ten groups, in order", () => {
    expect(ACTION_GROUPS.map(({ group }) => group)).toEqual([
      "auth",
      "staff",
      "patients",
      "specialties",
      "doctors",
      "appointments",
      "visits",
      "records",
      "money",
      "audit",
    ]);
  });

  it("knows an action only if the contract does", () => {
    expect(isAuditAction("discount.set")).toBe(true);
    expect(isAuditAction("discount.removed")).toBe(false);
  });
});
