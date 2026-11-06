import { describe, expect, it } from "vitest";
import { clinicNow } from "./clinic-now";

describe("clinicNow", () => {
  it("gives the clinic's date and time, whatever the computer's zone", () => {
    expect(clinicNow("Africa/Cairo", new Date("2026-02-01T10:05:00Z"))).toBe(
      "2026-02-01 12:05",
    );
    expect(clinicNow("Asia/Tokyo", new Date("2026-02-01T23:30:00Z"))).toBe(
      "2026-02-02 08:30",
    );
  });

  it("writes midnight as 00:00, on the new day", () => {
    expect(clinicNow("Africa/Cairo", new Date("2026-01-31T22:00:00Z"))).toBe(
      "2026-02-01 00:00",
    );
  });
});
