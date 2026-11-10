import { describe, expect, it } from "vitest";
import {
  addDays,
  clinicToday,
  endOfPreviousMonth,
  startOfMonth,
} from "./clinic-today";

describe("clinicToday", () => {
  it("uses the clinic's date when UTC is still on the day before", () => {
    // 23:30 UTC on the 8th is already 01:30 on the 9th in Cairo, in standard time.
    expect(clinicToday("Africa/Cairo", new Date("2026-12-08T23:30:00Z"))).toBe(
      "2026-12-09",
    );
  });

  it("uses the clinic's date when UTC is on the same day", () => {
    expect(clinicToday("Africa/Cairo", new Date("2026-12-08T12:00:00Z"))).toBe(
      "2026-12-08",
    );
  });

  it("follows daylight saving, when Cairo is three hours ahead", () => {
    expect(clinicToday("Africa/Cairo", new Date("2026-07-01T21:30:00Z"))).toBe(
      "2026-07-02",
    );
    expect(clinicToday("Africa/Cairo", new Date("2026-07-01T20:30:00Z"))).toBe(
      "2026-07-01",
    );
  });

  it("never depends on the machine's zone", () => {
    expect(clinicToday("Asia/Tokyo", new Date("2026-12-08T16:00:00Z"))).toBe(
      "2026-12-09",
    );
  });
});

describe("addDays", () => {
  it.each([
    ["2026-11-06", 30, "2026-12-06"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2028-02-28", 1, "2028-02-29"],
    ["2027-02-28", 1, "2027-03-01"],
    ["2026-11-06", 366, "2027-11-07"],
    ["2026-11-06", 0, "2026-11-06"],
  ])("%s plus %i days is %s", (date, count, expected) => {
    expect(addDays(date, count)).toBe(expected);
  });

  it("isn't changed by a daylight-saving date", () => {
    expect(addDays("2026-04-23", 7)).toBe("2026-04-30");
    expect(addDays("2026-10-29", 7)).toBe("2026-11-05");
  });
});

describe("startOfMonth and endOfPreviousMonth", () => {
  it.each([
    ["2026-01-01", "2026-01-01", "2025-12-31"],
    ["2026-12-31", "2026-12-01", "2026-11-30"],
    ["2028-03-01", "2028-03-01", "2028-02-29"],
    ["2027-03-15", "2027-03-01", "2027-02-28"],
    ["2026-11-15", "2026-11-01", "2026-10-31"],
  ])(
    "for %s, the month starts on %s and the one before ends on %s",
    (date, start, end) => {
      expect(startOfMonth(date)).toBe(start);
      expect(endOfPreviousMonth(date)).toBe(end);
    },
  );
});
