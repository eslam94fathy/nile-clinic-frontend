import { describe, expect, it } from "vitest";
import { groupByDoctor } from "./group-by-doctor";
import type { QueueEntry } from "./types";

function entry(id: number, doctorId: number): QueueEntry {
  return {
    id,
    queue_number: id,
    status: "waiting",
    walk_in: true,
    arrived_at: "2026-11-07T08:00:00.000000Z",
    called_at: null,
    finished_at: null,
    left_at: null,
    appointment: null,
    doctor: { id: doctorId, name: `Doctor ${doctorId}`, title: "Dr" },
    patient: { id: id + 100, full_name: "Synthetic", phone: "01000000001" },
  };
}

const shape = (entries: QueueEntry[]) =>
  groupByDoctor(entries).map((group) => [
    group.doctor.id,
    group.entries.map(({ id }) => id),
  ]);

describe("groupByDoctor", () => {
  it("gives nothing for nothing", () => {
    expect(groupByDoctor([])).toEqual([]);
  });

  it("keeps one doctor's rows in the API's order, whatever their numbers", () => {
    expect(shape([entry(9, 1), entry(2, 1), entry(5, 1)])).toEqual([
      [1, [9, 2, 5]],
    ]);
  });

  it("keeps doctors in the API's order, and doesn't sort them", () => {
    expect(shape([entry(1, 5), entry(2, 2), entry(3, 2)])).toEqual([
      [5, [1]],
      [2, [2, 3]],
    ]);
  });

  it("keeps a doctor who appears twice apart as two groups", () => {
    expect(shape([entry(1, 1), entry(2, 2), entry(3, 1)])).toEqual([
      [1, [1]],
      [2, [2]],
      [1, [3]],
    ]);
  });
});
