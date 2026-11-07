import { describe, expect, it } from "vitest";
import { freeTimeWindow } from "./free-time-window";

const today = "2026-11-07";
const horizon = "2027-02-05";

describe("freeTimeWindow", () => {
  it("gives seven days from today, with no earlier week", () => {
    expect(freeTimeWindow(today, today)).toEqual({
      from: today,
      to: "2026-11-13",
      next: "2026-11-14",
    });
  });

  it("offers both weeks in the middle", () => {
    expect(freeTimeWindow("2026-11-21", today)).toEqual({
      from: "2026-11-21",
      to: "2026-11-27",
      previous: "2026-11-14",
      next: "2026-11-28",
    });
  });

  it("never goes back before today", () => {
    expect(freeTimeWindow("2026-11-10", today).previous).toBe(today);
  });

  it("holds a past date to today, so that it's never requested", () => {
    expect(freeTimeWindow("2020-01-01", today).from).toBe(today);
  });

  it("holds a date beyond the limit to the limit", () => {
    expect(freeTimeWindow("2099-01-01", today)).toEqual({
      from: horizon,
      to: horizon,
      previous: "2027-01-29",
    });
  });

  it("stops at the limit, and offers no later week", () => {
    const window = freeTimeWindow("2027-02-01", today);
    expect(window.to).toBe(horizon);
    expect(window.next).toBeUndefined();
  });

  it("offers a last week that reaches the limit", () => {
    const window = freeTimeWindow("2027-01-28", today);
    expect(window.to).toBe("2027-02-03");
    expect(window.next).toBe("2027-02-04");
  });
});
