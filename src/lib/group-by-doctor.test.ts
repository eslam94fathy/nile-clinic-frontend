import { describe, expect, it } from "vitest";
import { groupByDoctor } from "./group-by-doctor";

type Row = {
  id: number;
  doctor: { id: number; name: string; title: string };
};

const row = (id: number, doctorId: number): Row => ({
  id,
  doctor: { id: doctorId, name: `Doctor ${doctorId}`, title: "Dr" },
});

const shape = (rows: Row[]) =>
  groupByDoctor(rows).map((group) => [
    group.doctor.id,
    group.rows.map(({ id }) => id),
  ]);

describe("groupByDoctor", () => {
  it("gives nothing for nothing", () => {
    expect(groupByDoctor([])).toEqual([]);
  });

  it("keeps one doctor's rows in the API's order, whatever their numbers", () => {
    expect(shape([row(9, 1), row(2, 1), row(5, 1)])).toEqual([[1, [9, 2, 5]]]);
  });

  it("keeps doctors in the API's order, and doesn't sort them", () => {
    expect(shape([row(1, 5), row(2, 2), row(3, 2)])).toEqual([
      [5, [1]],
      [2, [2, 3]],
    ]);
  });

  it("keeps a doctor who appears twice apart as two groups", () => {
    expect(shape([row(1, 1), row(2, 2), row(3, 1)])).toEqual([
      [1, [1]],
      [2, [2]],
      [1, [3]],
    ]);
  });

  it("keeps the whole doctor reference of the first row in each group", () => {
    const [group] = groupByDoctor([row(1, 7)]);
    expect(group?.doctor).toEqual({ id: 7, name: "Doctor 7", title: "Dr" });
  });
});
