import { describe, expect, it } from "vitest";
import { readChargeFilters } from "./read-charge-filters";

const TODAY = "2026-11-08";

describe("readChargeFilters", () => {
  it("shows the last 7 days, today included, by default", () => {
    expect(readChargeFilters({}, TODAY)).toEqual({
      from: "2026-11-02",
      to: TODAY,
      patientId: null,
      doctorId: null,
      status: null,
      page: 1,
      rangeProblem: null,
      patientProblem: false,
    });
  });

  it.each(["abc", "0", "-1"])(
    "reports a patient number that can't be one, %j, so nothing is read",
    (patient_id) => {
      expect(readChargeFilters({ patient_id }, TODAY)).toMatchObject({
        patientId: null,
        patientProblem: true,
      });
    },
  );

  it("crosses a month boundary for the default", () => {
    expect(readChargeFilters({}, "2026-03-03")).toMatchObject({
      from: "2026-02-25",
      to: "2026-03-03",
    });
  });

  it("takes one date alone as that day", () => {
    expect(readChargeFilters({ from: "2026-10-01" }, TODAY)).toMatchObject({
      from: "2026-10-01",
      to: "2026-10-01",
    });
    expect(readChargeFilters({ to: "2026-10-05" }, TODAY)).toMatchObject({
      from: "2026-10-05",
      to: "2026-10-05",
    });
  });

  it("allows 92 days, both ends included", () => {
    expect(
      readChargeFilters({ from: "2026-01-01", to: "2026-04-02" }, TODAY)
        .rangeProblem,
    ).toBeNull();
  });

  it("catches 93 days", () => {
    expect(
      readChargeFilters({ from: "2026-01-01", to: "2026-04-03" }, TODAY)
        .rangeProblem,
    ).toBe("too_long");
  });

  it("catches a range ending before it starts", () => {
    expect(
      readChargeFilters({ from: "2026-11-05", to: "2026-11-04" }, TODAY)
        .rangeProblem,
    ).toBe("reversed");
  });

  it("reads a patient, a doctor, a status, and a page", () => {
    expect(
      readChargeFilters(
        { patient_id: "12", doctor_id: "3", status: "cancelled", page: "4" },
        TODAY,
      ),
    ).toMatchObject({
      patientId: 12,
      doctorId: 3,
      status: "cancelled",
      page: 4,
    });
  });

  it.each([
    { from: "2026-02-30" },
    { doctor_id: "x" },
    { status: "none" },
    { page: "abc" },
  ])("ignores %j", (query) => {
    expect(readChargeFilters(query, TODAY)).toMatchObject({
      from: "2026-11-02",
      to: TODAY,
      patientId: null,
      doctorId: null,
      status: null,
      page: 1,
    });
  });
});
