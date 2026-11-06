import { describe, expect, it } from "vitest";
import { offeredActions } from "./offered-actions";

const before = "2026-11-08 09:19";
const atStart = "2026-11-08 09:20";
const after = "2026-11-09 00:00";

describe("offeredActions", () => {
  it("offers moving and cancelling before the start", () => {
    expect(offeredActions("scheduled", "2026-11-08", "09:20", before)).toEqual([
      "reschedule",
      "cancel",
    ]);
  });

  it("offers only a no-show from the minute of the start", () => {
    expect(offeredActions("scheduled", "2026-11-08", "09:20", atStart)).toEqual(
      ["no_show"],
    );
    expect(offeredActions("scheduled", "2026-11-08", "09:20", after)).toEqual([
      "no_show",
    ]);
  });

  for (const status of [
    "cancelled",
    "no_show",
    "checked_in",
    "completed",
  ] as const) {
    it(`offers nothing on ${status}`, () => {
      expect(offeredActions(status, "2026-11-08", "09:20", before)).toEqual([]);
      expect(offeredActions(status, "2026-11-08", "09:20", after)).toEqual([]);
    });
  }
});
