import { describe, expect, it } from "vitest";
import { encounterSchema, historyItemSchema, visitSchema } from "./encounter";

const patient = {
  id: 1,
  full_name: "Synthetic Patient",
  sex: "female",
  date_of_birth: "1990-01-01",
};

const visit = {
  id: 7,
  date: "2026-11-07",
  walk_in: false,
  arrived_at: "2026-11-07T08:00:00.000000Z",
  called_at: null,
  finished_at: null,
  record_status: "none",
  encounter_id: null,
  patient,
};

const encounter = {
  id: 3,
  visit_id: 7,
  status: "draft",
  date: "2026-11-07",
  doctor: { id: 2, name: "Synthetic Doctor", title: "Consultant" },
  patient,
  chief_complaint: null,
  examination_findings: null,
  diagnosis: null,
  treatment_plan: null,
  prescriptions: [],
  addenda: [],
  started_at: "2026-11-07T08:00:00.000000Z",
  last_saved_at: "2026-11-07T08:00:00.000000Z",
  finalized_at: null,
};

describe("response schemas", () => {
  it("accepts a visit with nothing yet", () => {
    expect(visitSchema.safeParse(visit).success).toBe(true);
  });

  it("refuses a record status it doesn't know", () => {
    expect(
      visitSchema.safeParse({ ...visit, record_status: "archived" }).success,
    ).toBe(false);
  });

  it("accepts an empty draft", () => {
    expect(encounterSchema.safeParse(encounter).success).toBe(true);
  });

  it("refuses a record status of none on a record", () => {
    expect(
      encounterSchema.safeParse({ ...encounter, status: "none" }).success,
    ).toBe(false);
  });

  it("accepts a line with only a medication", () => {
    const parsed = encounterSchema.safeParse({
      ...encounter,
      prescriptions: [
        {
          medication: "Synthetic",
          dosage: null,
          frequency: null,
          duration: null,
          instructions: null,
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("keeps a history row free of anything but its date and doctor", () => {
    const parsed = historyItemSchema.parse({
      id: 1,
      date: "2026-01-01",
      doctor: { id: 2, name: "Synthetic Doctor", specialties: [] },
      diagnosis: "Should not survive",
    });
    expect(parsed).not.toHaveProperty("diagnosis");
  });
});
