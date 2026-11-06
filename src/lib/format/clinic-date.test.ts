import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readClinicDate } from "./clinic-date";

describe("readClinicDate", () => {
  it.each(["2026-11-08", "2024-02-29", "2026-01-01", "2026-12-31"])(
    "returns %s unchanged",
    (value) => {
      expect(readClinicDate(value)).toBe(value);
    },
  );

  it.each([
    "2026-13-45",
    "2026-02-30",
    "2025-02-29",
    "2026-04-31",
    "2026-00-10",
    "2026-11-00",
    "08/11/2026",
    "2026-11-08T00:00:00Z",
    "",
    null,
    undefined,
  ])("gives nothing for %s", (value) => {
    expect(readClinicDate(value)).toBeNull();
  });

  it("never uses Date, which can shift the day", () => {
    const source = readFileSync("src/lib/format/clinic-date.ts", "utf8");
    expect(source).not.toMatch(/new Date|Date\.parse/);
  });
});
