import { describe, expect, it } from "vitest";
import { offeredEntryActions } from "./offered-entry-actions";

const appointment = { id: 7, start: "09:20", end: "09:40" };

describe("offeredEntryActions", () => {
  it("offers both on a waiting row from an appointment", () => {
    expect(offeredEntryActions({ status: "waiting", appointment })).toEqual([
      "mark_left",
      "undo",
    ]);
  });

  it("doesn't offer undoing on a waiting walk-in", () => {
    expect(
      offeredEntryActions({ status: "waiting", appointment: null }),
    ).toEqual(["mark_left"]);
  });

  for (const status of ["with_doctor", "seen", "left"] as const) {
    it(`offers nothing on ${status}`, () => {
      expect(offeredEntryActions({ status, appointment })).toEqual([]);
      expect(offeredEntryActions({ status, appointment: null })).toEqual([]);
    });
  }
});
