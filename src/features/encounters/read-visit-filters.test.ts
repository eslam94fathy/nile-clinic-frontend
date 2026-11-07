import { describe, expect, it } from "vitest";
import { readVisitFilters } from "./read-visit-filters";

const TODAY = "2026-11-07";

describe("readVisitFilters", () => {
  it("defaults to the last 30 days up to today", () => {
    expect(readVisitFilters({}, TODAY)).toEqual({
      from: "2026-10-08",
      to: TODAY,
    });
  });

  it("uses real dates from the address", () => {
    expect(
      readVisitFilters({ from: "2026-01-01", to: "2026-01-31" }, TODAY),
    ).toMatchObject({ from: "2026-01-01", to: "2026-01-31" });
  });

  it("treats one date alone as that day", () => {
    expect(readVisitFilters({ from: "2026-01-05" }, TODAY)).toMatchObject({
      from: "2026-01-05",
      to: "2026-01-05",
    });
    expect(readVisitFilters({ to: "2026-01-05" }, TODAY)).toMatchObject({
      from: "2026-01-05",
      to: "2026-01-05",
    });
  });

  it.each(["2026-02-30", "nonsense", "2026-1-1", ""])(
    "ignores %j as a date",
    (from) => {
      expect(readVisitFilters({ from }, TODAY)).toMatchObject({
        from: "2026-10-08",
        to: TODAY,
      });
    },
  );

  it("still sends a range that's too long, for the API to refuse", () => {
    expect(
      readVisitFilters({ from: "2020-01-01", to: "2026-01-01" }, TODAY),
    ).toMatchObject({ from: "2020-01-01", to: "2026-01-01" });
  });

  it("uses a status only if it's one of the three", () => {
    expect(
      readVisitFilters({ record_status: "draft" }, TODAY).record_status,
    ).toBe("draft");
    expect(
      readVisitFilters({ record_status: "archived" }, TODAY),
    ).not.toHaveProperty("record_status");
  });

  it.each([
    ["3", 3],
    ["0", undefined],
    ["-1", undefined],
    ["1.5", undefined],
    ["many", undefined],
  ])("reads page %s as %s", (page, expected) => {
    expect(readVisitFilters({ page }, TODAY).page).toBe(expected);
  });
});
