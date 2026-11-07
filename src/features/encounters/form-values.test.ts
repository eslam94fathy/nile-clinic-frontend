import { describe, expect, it } from "vitest";
import { EMPTY_LINE, hasChanged, recordToForm, toRequest } from "./form-values";
import type { Encounter } from "./types";

const record: Encounter = {
  id: 3,
  visit_id: 7,
  status: "draft",
  date: "2026-11-07",
  doctor: { id: 2, name: "Synthetic Doctor", title: "Consultant" },
  patient: {
    id: 1,
    full_name: "Synthetic Patient",
    sex: "female",
    date_of_birth: "1990-01-01",
  },
  chief_complaint: "شكوى تجريبية\nSecond line",
  examination_findings: null,
  diagnosis: null,
  treatment_plan: null,
  prescriptions: [
    {
      medication: "Synthetic",
      dosage: null,
      frequency: "Daily",
      duration: null,
      instructions: null,
    },
  ],
  addenda: [],
  started_at: "2026-11-07T08:00:00.000000Z",
  last_saved_at: "2026-11-07T08:00:00.000000Z",
  finalized_at: null,
};

describe("recordToForm", () => {
  it("turns nothing into empty text, and keeps text as written", () => {
    const form = recordToForm(record);
    expect(form.chief_complaint).toBe("شكوى تجريبية\nSecond line");
    expect(form.diagnosis).toBe("");
    expect(form.prescriptions[0]?.dosage).toBe("");
  });
});

describe("toRequest", () => {
  it("always sends all five keys, with empty ones as null", () => {
    const { body } = toRequest({
      chief_complaint: "",
      examination_findings: "",
      diagnosis: "",
      treatment_plan: "",
      prescriptions: [],
    });
    expect(body).toEqual({
      chief_complaint: null,
      examination_findings: null,
      diagnosis: null,
      treatment_plan: null,
      prescriptions: [],
    });
  });

  it("keeps line breaks inside text, and trims only the ends", () => {
    const form = { ...recordToForm(record), diagnosis: "  one\n\ntwo  " };
    expect(toRequest(form).body.diagnosis).toBe("one\n\ntwo");
  });

  it("treats a field of only spaces as empty", () => {
    const form = { ...recordToForm(record), diagnosis: "  \n " };
    expect(toRequest(form).body.diagnosis).toBeNull();
  });

  it("leaves out lines with nothing in them, and says which lines were sent", () => {
    const form = {
      ...recordToForm(record),
      prescriptions: [
        EMPTY_LINE,
        { ...EMPTY_LINE, medication: "First" },
        { ...EMPTY_LINE, instructions: "   " },
        { ...EMPTY_LINE, medication: "Second" },
      ],
    };
    const { body, sentLines } = toRequest(form);
    expect(body.prescriptions.map(({ medication }) => medication)).toEqual([
      "First",
      "Second",
    ]);
    expect(sentLines).toEqual([1, 3]);
  });

  it("sends a line with no medication, for the API to refuse", () => {
    const form = {
      ...recordToForm(record),
      prescriptions: [{ ...EMPTY_LINE, dosage: "One" }],
    };
    expect(toRequest(form).body.prescriptions[0]).toMatchObject({
      medication: "",
      dosage: "One",
    });
  });
});

describe("hasChanged", () => {
  it("is false for the record as it stands", () => {
    expect(hasChanged(recordToForm(record), record)).toBe(false);
  });

  it("isn't fooled by spaces at the ends or an empty line", () => {
    const form = recordToForm(record);
    form.chief_complaint = `  ${form.chief_complaint}  `;
    form.prescriptions.push(EMPTY_LINE);
    expect(hasChanged(form, record)).toBe(false);
  });

  it("is true for changed text", () => {
    const form = { ...recordToForm(record), diagnosis: "Synthetic" };
    expect(hasChanged(form, record)).toBe(true);
  });

  it("is true for a removed line", () => {
    const form = { ...recordToForm(record), prescriptions: [] };
    expect(hasChanged(form, record)).toBe(true);
  });

  it("is true for a changed line", () => {
    const form = recordToForm(record);
    form.prescriptions = [{ ...EMPTY_LINE, medication: "Other" }];
    expect(hasChanged(form, record)).toBe(true);
  });

  it("is true for lines in another order", () => {
    const saved: Encounter = {
      ...record,
      prescriptions: [{ medication: "A" }, { medication: "B" }],
    };
    const form = recordToForm(saved);
    form.prescriptions.reverse();
    expect(hasChanged(form, saved)).toBe(true);
  });
});
