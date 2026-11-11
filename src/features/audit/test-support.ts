import type { AuditEntry } from "./types";

/** A synthetic entry, with every detail present. */
export function syntheticEntry(change: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: 8124,
    occurred_at: "2026-11-05T22:30:07.000000Z",
    action: "discount.set",
    outcome: "succeeded",
    actor: {
      type: "staff",
      id: 3,
      name: "Synthetic Admin",
      role: "administrator",
    },
    subject: { type: "charge", id: 57 },
    patient_id: 12,
    network_address: "203.0.113.10",
    changes: {
      fields: ["discount", "discount_reason", "status"],
      values: {
        discount: { from: "0.00", to: "200.00" },
        status: { from: "unpaid", to: "paid" },
      },
    },
    filters: null,
    ...change,
  };
}
