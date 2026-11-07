import { describe, expect, it } from "vitest";
import { applyEntry } from "./apply-entry";
import type { OwnQueueEntry } from "./types";

function entry(id: number, status: OwnQueueEntry["status"]): OwnQueueEntry {
  return {
    id,
    queue_number: id,
    status,
    walk_in: true,
    arrived_at: "2026-11-07T08:00:00.000000Z",
    called_at: null,
    finished_at: null,
    left_at: null,
    appointment: null,
    patient: {
      id: id + 100,
      full_name: "Synthetic",
      sex: "male",
      date_of_birth: "1990-01-01",
    },
  };
}

describe("applyEntry", () => {
  it("replaces the matching row, and leaves the others and the order alone", () => {
    const list = [entry(3, "seen"), entry(1, "waiting"), entry(2, "waiting")];
    const answer = entry(1, "with_doctor");

    expect(applyEntry(list, answer)).toEqual([list[0], answer, list[2]]);
  });

  it("adds an answer about someone who arrived since the last read", () => {
    const list = [entry(1, "waiting")];
    const answer = entry(9, "with_doctor");

    expect(applyEntry(list, answer)).toEqual([list[0], answer]);
  });
});
