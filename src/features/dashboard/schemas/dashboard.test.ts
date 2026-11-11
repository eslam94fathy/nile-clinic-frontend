import { describe, expect, it } from "vitest";
import {
  activityPageSchema,
  appointmentRowSchema,
  countPageSchema,
  moneyTodaySchema,
  ownQueueSchema,
} from "./dashboard";

// Synthetic values only.
const anAppointment = {
  id: 7,
  date: "2026-11-11",
  start: "09:00",
  end: "09:20",
  status: "scheduled",
  outside_availability: false,
  doctor: { id: 3, name: "Synthetic Doctor", title: "Consultant" },
  patient: { id: 12, full_name: "Synthetic Patient", phone: "01000000000" },
};

describe("dashboard schemas", () => {
  it("keeps only a page's total for a count", () => {
    const parsed = countPageSchema.parse({
      data: [anAppointment],
      meta: { total: 42, per_page: 1 },
    });
    expect(parsed).toEqual({ meta: { total: 42 } });
  });

  it("drops a listed patient's phone", () => {
    const parsed = appointmentRowSchema.parse(anAppointment);
    expect(parsed.patient).toEqual({ full_name: "Synthetic Patient" });
    expect(JSON.stringify(parsed)).not.toContain("01000000000");
  });

  it("drops a doctor's own patient's sex and date of birth", () => {
    const parsed = ownQueueSchema.parse({
      data: [
        {
          id: 1,
          queue_number: 4,
          status: "waiting",
          walk_in: false,
          arrived_at: "2026-11-11T07:00:00.000000Z",
          called_at: null,
          finished_at: null,
          left_at: null,
          appointment: null,
          patient: {
            id: 12,
            full_name: "Synthetic Patient",
            sex: "female",
            date_of_birth: "1990-01-01",
          },
        },
      ],
    });
    expect(parsed.data[0]?.patient).toEqual({ full_name: "Synthetic Patient" });
  });

  it("refuses an amount sent as a number, rather than converting it", () => {
    const figures = { received: 350, refunded: "0.00", net: "350.00" };
    expect(
      moneyTodaySchema.safeParse({ data: { totals: figures, by_method: [] } })
        .success,
    ).toBe(false);
  });

  it("refuses an amount that isn't the contract's two-decimal text, as Reports does", () => {
    for (const received of ["350", "1e3", "350.5", "-350.00"]) {
      const figures = { received, refunded: "0.00", net: "350.00" };
      expect(
        moneyTodaySchema.safeParse({ data: { totals: figures, by_method: [] } })
          .success,
        received,
      ).toBe(false);
    }
  });

  it("keeps money as sent, including a negative net and an unknown method", () => {
    const parsed = moneyTodaySchema.parse({
      data: {
        from: "2026-11-11",
        to: "2026-11-11",
        totals: { received: "0.00", refunded: "50.00", net: "-50.00" },
        by_method: [
          {
            method: "voucher",
            received: "0.00",
            refunded: "50.00",
            net: "-50.00",
            staff: [],
          },
        ],
        by_day: [],
      },
    });
    expect(parsed.data.totals.net).toBe("-50.00");
    expect(parsed.data.by_method[0]?.method).toBe("voucher");
  });

  it("reads activity totals, with or without new patients, and a null rate", () => {
    const totals = {
      appointments: {
        scheduled: 1,
        cancelled: 0,
        no_show: 0,
        checked_in: 2,
        completed: 3,
      },
      no_show_rate: null,
      visits: {
        waiting: 1,
        with_doctor: 1,
        seen: 3,
        left: 0,
        booked: 4,
        walk_in: 1,
      },
    };
    expect(
      activityPageSchema.parse({ data: [], totals }).totals.no_show_rate,
    ).toBeNull();
    expect(
      activityPageSchema.parse({ totals: { ...totals, new_patients: 2 } })
        .totals.new_patients,
    ).toBe(2);
  });
});
