import { describe, expect, it } from "vitest";
import { formatInstant, parseInstant } from "./instant";

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

describe("formatInstant with seconds", () => {
  const precise = new Date("2026-11-05T22:30:07Z");

  it("shows the seconds, in the clinic's time zone", () => {
    const cairo = formatInstant(precise, "en", "Africa/Cairo", {
      seconds: true,
    });

    expect(cairo).toContain("Nov 6");
    expect(cairo).toMatch(/12:30:07/);
  });

  it("leaves them out by default", () => {
    expect(formatInstant(precise, "en", "Africa/Cairo")).not.toMatch(/:07/);
  });

  it("shows them in Arabic too", () => {
    const arabic = formatInstant(precise, "ar", "Africa/Cairo", {
      seconds: true,
    });

    expect(arabic).toMatch(/[؀-ۿ]/);
    expect(arabic).toMatch(/07/);
  });
});

describe("parseInstant", () => {
  it("reads the backend's two spellings as the same moment", () => {
    const offset = parseInstant("2026-11-05T14:22:31+00:00");
    const micro = parseInstant("2026-11-05T14:22:31.000000Z");

    expect(offset?.getTime()).toBe(Date.UTC(2026, 10, 5, 14, 22, 31));
    expect(micro?.getTime()).toBe(offset?.getTime());
  });

  it("keeps a real offset", () => {
    expect(parseInstant("2026-11-05T16:22:31+02:00")?.toISOString()).toBe(
      "2026-11-05T14:22:31.000Z",
    );
  });

  it.each([
    "2026-11-05",
    "2026-11-05T14:22:31",
    "not a date",
    "2026-13-45T14:22:31Z",
    "2026-02-31T10:00:00.000Z",
    "2026-04-31T10:00:00Z",
    "2026-11-05T25:00:00Z",
    "",
    null,
    undefined,
  ])("gives nothing for %s", (value) => {
    expect(parseInstant(value)).toBeNull();
  });
});

describe("digits", () => {
  it("are Western in Arabic", () => {
    expect(formatInstant(instant, "ar", "Africa/Cairo")).not.toMatch(/[٠-٩]/);
  });
});
