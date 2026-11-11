import { describe, expect, it } from "vitest";
import { auditPageSchema } from "./audit";

const entry = {
  id: 8124,
  occurred_at: "2026-11-05T14:22:31.000000Z",
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
};

const page = (data: unknown[]) => ({
  data,
  meta: { per_page: 25, next_cursor: "abc", prev_cursor: null },
});

describe("auditPageSchema", () => {
  it("reads the contract's example", () => {
    const parsed = auditPageSchema.parse(page([entry]));
    expect(parsed.data[0]?.changes?.values.discount?.to).toBe("200.00");
    expect(parsed.meta.next_cursor).toBe("abc");
  });

  it("reads a search with its filters, and the system and unknown actors", () => {
    const searched = {
      ...entry,
      action: "audit.searched",
      subject: null,
      patient_id: null,
      changes: null,
      filters: { patient_id: 12, from: "2026-11-01" },
    };
    const system = {
      ...entry,
      actor: { type: "system", id: null, name: null, role: null },
      network_address: null,
    };
    const unknown = {
      ...entry,
      action: "auth.sign_in",
      outcome: "refused",
      actor: { type: "unknown", id: null, name: null, role: null },
    };

    expect(
      auditPageSchema.safeParse(page([searched, system, unknown])).success,
    ).toBe(true);
  });

  it("drops what the same-origin route removes", () => {
    const parsed = auditPageSchema.parse({
      ...page([]),
      links: { next: "http://private" },
    });
    expect(parsed).not.toHaveProperty("links");
  });

  // A backend addition is shown as sent, never a failed page that each retry would record again (FR-012).
  it.each([
    ["an action the contract doesn't define", { action: "discount.removed" }],
    ["an unknown outcome", { outcome: "maybe" }],
    ["an unknown record type", { subject: { type: "invoice", id: 1 } }],
    [
      "an unknown actor type and role",
      { actor: { type: "service", id: 4, name: null, role: "auditor" } },
    ],
  ])("keeps %s as sent", (_, change) => {
    const parsed = auditPageSchema.parse(page([{ ...entry, ...change }]));
    expect(parsed.data[0]).toMatchObject(change);
  });

  it.each([
    [
      "a filter that is neither text nor a number",
      { filters: { amount: true } },
    ],
    ["an action that isn't text", { action: 7 }],
    ["a record without its number", { subject: { type: "charge" } }],
  ])("refuses %s", (_, change) => {
    expect(
      auditPageSchema.safeParse(page([{ ...entry, ...change }])).success,
    ).toBe(false);
  });
});
