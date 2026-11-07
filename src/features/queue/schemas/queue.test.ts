import { describe, expect, it } from "vitest";
import { ownQueueEntrySchema, queueEntrySchema } from "./queue";

const fields = {
  id: 5,
  queue_number: 3,
  status: "waiting",
  walk_in: false,
  arrived_at: "2026-11-07T08:00:00.000000Z",
  called_at: null,
  finished_at: null,
  left_at: null,
  appointment: { id: 7, start: "09:20", end: "24:00" },
};
const entry = {
  ...fields,
  doctor: { id: 3, name: "Synthetic Doctor", title: "Consultant" },
  patient: { id: 12, full_name: "Synthetic Patient", phone: "01000000001" },
};
const own = {
  ...fields,
  patient: {
    id: 12,
    full_name: "Synthetic Patient",
    sex: "female",
    date_of_birth: "1990-04-12",
  },
};

describe("queue entries", () => {
  it("accepts the contract's shape for reception", () => {
    expect(queueEntrySchema.safeParse(entry).success).toBe(true);
  });

  it("accepts the contract's shape for a doctor", () => {
    expect(ownQueueEntrySchema.safeParse(own).success).toBe(true);
  });

  it("accepts a walk-in, with no appointment", () => {
    const walkIn = { ...entry, walk_in: true, appointment: null };
    expect(queueEntrySchema.safeParse(walkIn).success).toBe(true);
  });

  it("accepts all four moments being set", () => {
    const seen = {
      ...entry,
      called_at: "2026-11-07T08:10:00.000000Z",
      finished_at: "2026-11-07T08:20:00.000000Z",
      left_at: "2026-11-07T08:30:00+00:00",
    };
    expect(queueEntrySchema.safeParse(seen).success).toBe(true);
  });

  it("refuses a status the contract doesn't have", () => {
    expect(
      queueEntrySchema.safeParse({ ...entry, status: "gone" }).success,
    ).toBe(false);
  });

  it("refuses a doctor's entry with no date of birth", () => {
    const patient = { ...own.patient, date_of_birth: undefined };
    expect(ownQueueEntrySchema.safeParse({ ...own, patient }).success).toBe(
      false,
    );
  });

  it("keeps no field the contract doesn't send, such as a note", () => {
    const parsed = queueEntrySchema.parse({ ...entry, note: "Synthetic" });
    expect(parsed).not.toHaveProperty("note");
  });
});
