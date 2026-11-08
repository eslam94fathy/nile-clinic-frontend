import { describe, expect, it } from "vitest";
import { pageSchema } from "@/lib/api/pagination";
import {
  chargeSchema,
  chargeSummarySchema,
  visitChargeSchema,
} from "./billing";

const doctor = { id: 3, name: "Synthetic Doctor", title: "Consultant" };
const patient = {
  id: 12,
  full_name: "Synthetic Patient",
  phone: "01000000001",
};
const staff = { id: 2, name: "Synthetic Reception" };

const visit = {
  id: 40,
  date: "2026-11-08",
  status: "seen",
  walk_in: false,
  doctor,
  patient,
  charge_status: "partially_paid",
  charge_id: 9,
  balance: "150.00",
};
const summary = {
  id: 9,
  visit_id: 40,
  status: "partially_paid",
  date: "2026-11-08",
  doctor,
  patient,
  fee: "350.00",
  discount: "50.00",
  amount_due: "300.00",
  amount_paid: "150.00",
  balance: "150.00",
  charged_at: "2026-11-08T08:00:00.000000Z",
};
const charge = {
  ...summary,
  charged_by: staff,
  discount_reason: "Synthetic hardship discount",
  discounted_by: { id: 1, name: "Synthetic Admin" },
  discounted_at: "2026-11-08T08:05:00.000000Z",
  cancel_reason: null,
  cancelled_by: null,
  cancelled_at: null,
  payments: [
    {
      id: 1,
      amount: "200.00",
      method: "cash",
      received_by: staff,
      received_at: "2026-11-08T08:10:00.000000Z",
    },
  ],
  refunds: [
    {
      id: 2,
      amount: "50.00",
      method: "card",
      reason: "Synthetic overpayment",
      refunded_by: { id: 1, name: "Synthetic Admin" },
      refunded_at: "2026-11-08T08:20:00.000000Z",
    },
  ],
};

describe("a visit on Billing", () => {
  it("accepts one with a charge, keeping money as text", () => {
    expect(visitChargeSchema.parse(visit).balance).toBe("150.00");
  });

  it("accepts one with no charge, whose balance and charge are null", () => {
    const none = {
      ...visit,
      charge_status: "none",
      charge_id: null,
      balance: null,
    };
    expect(visitChargeSchema.parse(none)).toEqual(none);
  });

  it.each(["cancelled", "owed", ""])(
    "refuses the charge status %j",
    (value) => {
      expect(
        visitChargeSchema.safeParse({ ...visit, charge_status: value }).success,
      ).toBe(false);
    },
  );

  it("refuses a queue status the contract doesn't have", () => {
    expect(
      visitChargeSchema.safeParse({ ...visit, status: "gone" }).success,
    ).toBe(false);
  });
});

describe("charges", () => {
  it("accepts a summary, and a page of them", () => {
    expect(chargeSummarySchema.parse(summary)).toEqual(summary);
    expect(
      pageSchema(chargeSummarySchema).parse({
        data: [summary],
        meta: {
          current_page: 1,
          last_page: 1,
          per_page: 15,
          total: 1,
          from: 1,
          to: 1,
        },
      }).data,
    ).toHaveLength(1);
  });

  it("accepts a cancelled charge whose visit is gone", () => {
    const gone = { ...summary, status: "cancelled", visit_id: null };
    expect(chargeSummarySchema.parse(gone).visit_id).toBeNull();
  });

  it("accepts a whole charge, with its payments and refunds in the API's order", () => {
    const parsed = chargeSchema.parse(charge);
    expect(parsed.payments.map(({ id }) => id)).toEqual([1]);
    expect(parsed.refunds[0]?.reason).toBe("Synthetic overpayment");
  });

  it.each(["350", "350.0", "350.000", "-1.00", "1e3", 350])(
    "refuses the amount %j, which isn't the API's money",
    (fee) => {
      expect(chargeSummarySchema.safeParse({ ...summary, fee }).success).toBe(
        false,
      );
    },
  );

  it.each(["none", "refunded"])("refuses the charge status %j", (status) => {
    expect(chargeSummarySchema.safeParse({ ...summary, status }).success).toBe(
      false,
    );
  });

  it("refuses a payment method the contract doesn't have", () => {
    const bad = {
      ...charge,
      payments: [{ ...charge.payments[0], method: "cheque" }],
    };
    expect(chargeSchema.safeParse(bad).success).toBe(false);
  });
});
