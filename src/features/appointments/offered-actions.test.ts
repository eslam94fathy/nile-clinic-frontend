import { describe, expect, it } from "vitest";
import { offeredActions } from "./offered-actions";

const before = "2026-11-08 09:19";
const atStart = "2026-11-08 09:20";
const after = "2026-11-09 00:00";

describe("offeredActions", () => {
  it("offers checking in, moving, and cancelling before the start, on the day", () => {
    expect(offeredActions("scheduled", "2026-11-08", "09:20", before)).toEqual([
      "check_in",
      "reschedule",
      "cancel",
    ]);
  });

  it("offers moving and cancelling, and no check-in, on an earlier day", () => {
    expect(
      offeredActions("scheduled", "2026-11-08", "09:20", "2026-11-07 09:00"),
    ).toEqual(["reschedule", "cancel"]);
  });

  it("offers checking in and a no-show from the minute of the start, on the day", () => {
    expect(offeredActions("scheduled", "2026-11-08", "09:20", atStart)).toEqual(
      ["check_in", "no_show"],
    );
  });

  it("offers only a no-show on a later day", () => {
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
