import { describe, expect, it } from "vitest";
import { daysIncluding, readDateRange } from "./date-range";

const DEFAULT = { from: "2026-11-01", to: "2026-11-08" };
const REPORTS = {
  maxDays: 366,
  defaultRange: DEFAULT,
  oneDate: "missing",
} as const;

describe("daysIncluding", () => {
  it("counts both ends", () => {
    expect(daysIncluding("2026-11-08", "2026-11-08")).toBe(1);
    expect(daysIncluding("2026-02-27", "2026-03-01")).toBe(3);
    expect(daysIncluding("2028-02-27", "2028-03-01")).toBe(4);
  });

  it("counts years below 100 as written, not as 19xx", () => {
    expect(daysIncluding("0099-12-31", "0100-01-01")).toBe(2);
  });
});

describe("readDateRange", () => {
  it("takes the default with neither date", () => {
    expect(readDateRange({}, REPORTS)).toEqual({
      ...DEFAULT,
      problem: null,
      given: false,
    });
  });

  it("treats a date that isn't real as absent", () => {
    expect(
      readDateRange({ from: "2026-02-30", to: "nope" }, REPORTS),
    ).toMatchObject({ ...DEFAULT, problem: null, given: false });
  });

  it("reports the other date as missing when told to", () => {
    expect(readDateRange({ from: "2026-10-01" }, REPORTS).problem).toBe(
      "missing_to",
    );
    expect(readDateRange({ to: "2026-10-01" }, REPORTS).problem).toBe(
      "missing_from",
    );
  });

  it("reads one date as that day when told to", () => {
    expect(
      readDateRange({ to: "2026-10-01" }, { ...REPORTS, oneDate: "same-day" }),
    ).toEqual({
      from: "2026-10-01",
      to: "2026-10-01",
      problem: null,
      given: true,
    });
  });

  it("allows 366 days, both ends included, and catches 367", () => {
    expect(
      readDateRange({ from: "2026-01-01", to: "2027-01-01" }, REPORTS).problem,
    ).toBeNull();
    expect(
      readDateRange({ from: "2026-01-01", to: "2027-01-02" }, REPORTS).problem,
    ).toBe("too_long");
  });

  it("catches a range ending before it starts", () => {
    expect(
      readDateRange({ from: "2026-11-05", to: "2026-11-04" }, REPORTS).problem,
    ).toBe("reversed");
  });
});
