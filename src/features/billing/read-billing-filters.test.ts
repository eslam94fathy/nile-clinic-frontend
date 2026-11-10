import { describe, expect, it } from "vitest";
import { readBillingFilters } from "./read-billing-filters";

const TODAY = "2026-11-08";

describe("readBillingFilters", () => {
  it("shows today for everyone, on the first page, by default", () => {
    expect(readBillingFilters({}, TODAY)).toEqual({
      date: TODAY,
      isToday: true,
      doctorId: null,
      chargeStatus: null,
      page: 1,
    });
  });

  it("reads another date, which isn't today", () => {
    expect(readBillingFilters({ date: "2026-11-01" }, TODAY)).toMatchObject({
      date: "2026-11-01",
      isToday: false,
    });
  });

  it("treats today's date given in the address as today", () => {
    expect(readBillingFilters({ date: TODAY }, TODAY).isToday).toBe(true);
  });

  it.each(["2026-02-30", "08-11-2026", "yesterday", ""])(
    "ignores the date %j",
    (date) => {
      expect(readBillingFilters({ date }, TODAY)).toMatchObject({
        date: TODAY,
        isToday: true,
      });
    },
  );

  it("reads a doctor, a charge status, and a page", () => {
    expect(
      readBillingFilters(
        { doctor_id: "3", charge_status: "none", page: "2" },
        TODAY,
      ),
    ).toMatchObject({ doctorId: 3, chargeStatus: "none", page: 2 });
  });

  it.each([
    { doctor_id: "0" },
    { doctor_id: "abc" },
    { charge_status: "cancelled" },
    { charge_status: "owed" },
    { page: "0" },
    { page: "1.5" },
  ])("ignores %j", (query) => {
    expect(readBillingFilters(query, TODAY)).toMatchObject({
      doctorId: null,
      chargeStatus: null,
      page: 1,
    });
  });
});
