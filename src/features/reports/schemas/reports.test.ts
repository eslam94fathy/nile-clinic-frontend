import { describe, expect, it } from "vitest";
import {
  activityPageSchema,
  billingPageSchema,
  moneyCollectedSchema,
  timesPageSchema,
} from "./reports";

const meta = {
  current_page: 1,
  last_page: 1,
  per_page: 15,
  total: 1,
  from: 1,
  to: 1,
};
const doctor = { id: 3, name: "Synthetic Doctor", title: null };
const figures = { received: "350.00", refunded: "400.00", net: "-50.00" };

const moneyCollected = {
  data: {
    from: "2026-11-01",
    to: "2026-11-08",
    totals: figures,
    by_method: [
      {
        ...figures,
        method: "cash",
        staff: [{ ...figures, id: 2, name: "Synthetic Reception" }],
      },
    ],
    by_day: [{ ...figures, date: "2026-11-02" }],
  },
};

const billing = {
  active_charges: 2,
  fees: "700.00",
  discounts: "50.00",
  amount_due: "650.00",
  amount_paid: "300.00",
  balance: "350.00",
  cancelled_charges: 1,
  uncharged_seen_visits: 1,
};

const activity = {
  appointments: {
    scheduled: 1,
    cancelled: 1,
    no_show: 1,
    checked_in: 0,
    completed: 7,
  },
  no_show_rate: 12.5,
  visits: {
    waiting: 0,
    with_doctor: 0,
    seen: 7,
    left: 1,
    booked: 7,
    walk_in: 1,
  },
};

const times = {
  wait: { average_minutes: 12, visits: 8 },
  consultation: { average_minutes: null, visits: 0 },
  records: { finalized: 5, draft: 1, none: 1 },
};

describe("report schemas", () => {
  it("accept the money collected, with a negative net", () => {
    expect(moneyCollectedSchema.safeParse(moneyCollected).success).toBe(true);
  });

  it("refuse money as a number, and a negative where only a net may be one", () => {
    const asNumber = structuredClone(moneyCollected);
    Object.assign(asNumber.data.totals, { received: 350 });
    expect(moneyCollectedSchema.safeParse(asNumber).success).toBe(false);

    const negativeReceived = structuredClone(moneyCollected);
    negativeReceived.data.totals.received = "-1.00";
    expect(moneyCollectedSchema.safeParse(negativeReceived).success).toBe(
      false,
    );
  });

  it("refuse an unknown method", () => {
    const body = structuredClone(moneyCollected);
    Object.assign(body.data.by_method[0] ?? {}, { method: "cheque" });
    expect(moneyCollectedSchema.safeParse(body).success).toBe(false);
  });

  it("accept a page of doctors with totals", () => {
    expect(
      billingPageSchema.safeParse({
        data: [{ doctor, ...billing }],
        totals: billing,
        meta,
      }).success,
    ).toBe(true);
    expect(
      timesPageSchema.safeParse({
        data: [{ doctor, ...times }],
        totals: times,
        meta,
      }).success,
    ).toBe(true);
  });

  it("refuse a page without totals", () => {
    expect(
      billingPageSchema.safeParse({ data: [{ doctor, ...billing }], meta })
        .success,
    ).toBe(false);
  });

  it("keep new patients absent, not zero, when the API leaves it out", () => {
    const withDoctor = activityPageSchema.parse({
      data: [{ doctor, ...activity }],
      totals: activity,
      meta,
    });
    expect("new_patients" in withDoctor.totals).toBe(false);

    const overall = activityPageSchema.parse({
      data: [],
      totals: { ...activity, new_patients: 0 },
      meta,
    });
    expect(overall.totals.new_patients).toBe(0);
  });

  it("accept a missing no-show rate and average, and refuse a fractional average", () => {
    expect(
      activityPageSchema.safeParse({
        data: [],
        totals: { ...activity, no_show_rate: null },
        meta,
      }).success,
    ).toBe(true);
    expect(
      timesPageSchema.safeParse({
        data: [],
        totals: { ...times, wait: { average_minutes: 12.5, visits: 2 } },
        meta,
      }).success,
    ).toBe(false);
  });
});
