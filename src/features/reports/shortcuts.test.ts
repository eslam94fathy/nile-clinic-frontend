import { describe, expect, it } from "vitest";
import { currentShortcut, reportShortcuts } from "./shortcuts";

describe("reportShortcuts", () => {
  it("works out each period from the clinic's today", () => {
    expect(reportShortcuts("2026-11-15")).toEqual({
      today: { from: "2026-11-15", to: "2026-11-15" },
      last7Days: { from: "2026-11-09", to: "2026-11-15" },
      thisMonth: { from: "2026-11-01", to: "2026-11-15" },
      lastMonth: { from: "2026-10-01", to: "2026-10-31" },
    });
  });

  it.each([
    ["2026-01-01", "2025-12-26", "2025-12-01", "2025-12-31"],
    ["2026-12-31", "2026-12-25", "2026-11-01", "2026-11-30"],
    ["2028-03-01", "2028-02-24", "2028-02-01", "2028-02-29"],
  ])(
    "is right at a month or year end, on %s",
    (today, weekStart, lastMonthStart, lastMonthEnd) => {
      const shortcuts = reportShortcuts(today);
      expect(shortcuts.last7Days).toEqual({ from: weekStart, to: today });
      expect(shortcuts.lastMonth).toEqual({
        from: lastMonthStart,
        to: lastMonthEnd,
      });
      expect(shortcuts.thisMonth.to).toBe(today);
    },
  );
});

describe("currentShortcut", () => {
  const shortcuts = reportShortcuts("2026-11-15");

  it("is this month for the default period", () => {
    expect(
      currentShortcut(
        {
          from: "2026-11-01",
          to: "2026-11-15",
          isDefaultPeriod: true,
          rangeProblem: null,
        },
        shortcuts,
      ),
    ).toBe("thisMonth");
  });

  it("matches both dates, or none", () => {
    expect(
      currentShortcut(
        {
          from: "2026-10-01",
          to: "2026-10-31",
          isDefaultPeriod: false,
          rangeProblem: null,
        },
        shortcuts,
      ),
    ).toBe("lastMonth");
    expect(
      currentShortcut(
        {
          from: "2026-10-01",
          to: "2026-10-30",
          isDefaultPeriod: false,
          rangeProblem: null,
        },
        shortcuts,
      ),
    ).toBeNull();
  });

  it("names none for a period the page is refusing, though one date alone looks like today", () => {
    expect(
      currentShortcut(
        {
          from: "2026-11-15",
          to: "2026-11-15",
          isDefaultPeriod: false,
          rangeProblem: "missing_to",
        },
        shortcuts,
      ),
    ).toBeNull();
  });

  it("prefers today over this month on the first of the month", () => {
    expect(
      currentShortcut(
        {
          from: "2026-11-01",
          to: "2026-11-01",
          isDefaultPeriod: false,
          rangeProblem: null,
        },
        reportShortcuts("2026-11-01"),
      ),
    ).toBe("today");
  });
});
