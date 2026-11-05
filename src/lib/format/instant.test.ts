import { describe, expect, it } from "vitest";
import { formatInstant } from "./instant";

// 22:30 UTC is 00:30 the next day in Cairo in November, and 17:30 in New York.
const instant = new Date("2026-11-05T22:30:00Z");

describe("formatInstant", () => {
  it("uses the given time zone, not the system's", () => {
    const cairo = formatInstant(instant, "en", "Africa/Cairo");
    const newYork = formatInstant(instant, "en", "America/New_York");

    expect(cairo).toContain("Nov 6");
    expect(cairo).toMatch(/12:30/);
    expect(newYork).toContain("Nov 5");
    expect(newYork).toMatch(/5:30/);
  });

  it("formats in the given language", () => {
    const arabic = formatInstant(instant, "ar", "Africa/Cairo");

    expect(arabic).toMatch(/[؀-ۿ]/);
    expect(arabic).not.toBe(formatInstant(instant, "en", "Africa/Cairo"));
  });
});
