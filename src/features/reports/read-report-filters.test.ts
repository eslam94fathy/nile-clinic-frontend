import { describe, expect, it } from "vitest";
import { readReportFilters } from "./read-report-filters";

const TODAY = "2026-11-08";

describe("readReportFilters", () => {
  it("shows this month to today by default", () => {
    expect(readReportFilters({}, TODAY)).toEqual({
      from: "2026-11-01",
      to: TODAY,
      doctorId: null,
      page: 1,
      rangeProblem: null,
      isDefaultPeriod: true,
    });
  });

  it("is today alone on the first of the month", () => {
    expect(readReportFilters({}, "2026-12-01")).toMatchObject({
      from: "2026-12-01",
      to: "2026-12-01",
    });
  });

  it("reports one date alone as missing the other, rather than guessing", () => {
    expect(readReportFilters({ from: "2026-10-01" }, TODAY)).toMatchObject({
      rangeProblem: "missing_to",
      isDefaultPeriod: false,
    });
    expect(readReportFilters({ to: "2026-10-01" }, TODAY).rangeProblem).toBe(
      "missing_from",
    );
  });

  it("allows 366 days and catches 367 and a reversed period", () => {
    expect(
      readReportFilters({ from: "2026-01-01", to: "2027-01-01" }, TODAY)
        .rangeProblem,
    ).toBeNull();
    expect(
      readReportFilters({ from: "2026-01-01", to: "2027-01-02" }, TODAY)
        .rangeProblem,
    ).toBe("too_long");
    expect(
      readReportFilters({ from: "2026-11-05", to: "2026-11-04" }, TODAY)
        .rangeProblem,
    ).toBe("reversed");
  });

  it("reads a doctor and a page", () => {
    expect(
      readReportFilters(
        { from: "2026-10-01", to: "2026-10-31", doctor_id: "3", page: "2" },
        TODAY,
      ),
    ).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
      doctorId: 3,
      page: 2,
      rangeProblem: null,
      isDefaultPeriod: false,
    });
  });

  it.each([
    ["doctor_id", "abc"],
    ["doctor_id", "0"],
    ["page", "-2"],
    ["page", "1.5"],
  ])("ignores %s=%j, which can't be valid", (name, value) => {
    expect(readReportFilters({ [name]: value }, TODAY)).toMatchObject({
      doctorId: null,
      page: 1,
    });
  });
});
