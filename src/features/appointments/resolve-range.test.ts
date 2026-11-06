import { describe, expect, it } from "vitest";
import { resolveRange } from "./resolve-range";

const today = "2026-12-20";

describe("resolveRange", () => {
  it("is today alone with no filters", () => {
    expect(resolveRange({}, today)).toEqual({ from: today, to: today });
  });

  it("covers everything upcoming for a patient, across a year's end", () => {
    expect(resolveRange({ patient_id: "12" }, today)).toEqual({
      from: today,
      to: "2027-03-20",
    });
  });

  it("covers everything upcoming when needing a move", () => {
    expect(resolveRange({ outside_availability: "1" }, today)).toEqual({
      from: today,
      to: "2027-03-20",
    });
  });

  it("uses what's in the address, over any default", () => {
    expect(
      resolveRange(
        { from: "2026-01-01", to: "2026-01-31", patient_id: "12" },
        today,
      ),
    ).toEqual({ from: "2026-01-01", to: "2026-01-31" });
  });

  it("makes one date a single day, so the fields shown match what's read", () => {
    expect(resolveRange({ from: "2026-01-01" }, today)).toEqual({
      from: "2026-01-01",
      to: "2026-01-01",
    });
    expect(resolveRange({ to: "2026-01-31" }, today)).toEqual({
      from: "2026-01-31",
      to: "2026-01-31",
    });
  });
});
