import { describe, expect, it } from "vitest";
import { readAuditFilters, sameFilters } from "./read-audit-filters";

describe("readAuditFilters", () => {
  it("leaves out every empty filter", () => {
    expect(
      readAuditFilters({
        from: "",
        to: " ",
        staff_id: "",
        patient_id: "",
        subject_type: "",
        subject_id: "",
        action: "",
        outcome: "",
      }),
    ).toEqual({ ok: true, filters: {} });
  });

  it("reads every filter", () => {
    expect(
      readAuditFilters({
        from: "2026-11-01",
        to: "2026-11-05",
        staff_id: "3",
        patient_id: "12",
        subject_type: "charge",
        subject_id: "57",
        action: "discount.set",
        outcome: "succeeded",
      }),
    ).toEqual({
      ok: true,
      filters: {
        from: "2026-11-01",
        to: "2026-11-05",
        staff_id: 3,
        patient_id: 12,
        subject_type: "charge",
        subject_id: 57,
        action: "discount.set",
        outcome: "succeeded",
      },
    });
  });

  it("reads Arabic digits", () => {
    expect(
      readAuditFilters({
        patient_id: "١٢",
        subject_type: "appointment",
        subject_id: "٤٠",
      }),
    ).toEqual({
      ok: true,
      filters: { patient_id: 12, subject_type: "appointment", subject_id: 40 },
    });
  });

  it("allows one date alone", () => {
    expect(readAuditFilters({ from: "2026-11-01" })).toEqual({
      ok: true,
      filters: { from: "2026-11-01" },
    });
    expect(readAuditFilters({ to: "2026-11-01" })).toEqual({
      ok: true,
      filters: { to: "2026-11-01" },
    });
  });

  it("allows the same day at both ends", () => {
    expect(readAuditFilters({ from: "2026-11-01", to: "2026-11-01" }).ok).toBe(
      true,
    );
  });

  it("refuses an end before the start, on the end", () => {
    expect(readAuditFilters({ from: "2026-11-05", to: "2026-11-01" })).toEqual({
      ok: false,
      problems: { to: "reversed" },
    });
  });

  it.each(["0", "-3", "2.5", "12a", "1e3"])(
    "refuses %s as a number",
    (text) => {
      expect(readAuditFilters({ patient_id: text })).toEqual({
        ok: false,
        problems: { patient_id: "notANumber" },
      });
      expect(readAuditFilters({ staff_id: text })).toEqual({
        ok: false,
        problems: { staff_id: "notANumber" },
      });
    },
  );

  it("needs a record's type and number together", () => {
    expect(readAuditFilters({ subject_type: "charge" })).toEqual({
      ok: false,
      problems: { subject_id: "needsNumber" },
    });
    expect(readAuditFilters({ subject_id: "57" })).toEqual({
      ok: false,
      problems: { subject_type: "needsType" },
    });
  });

  it("reports every problem at once", () => {
    const reading = readAuditFilters({
      from: "2026-11-05",
      to: "2026-11-01",
      patient_id: "x",
      subject_id: "0",
    });
    expect(reading).toEqual({
      ok: false,
      problems: {
        to: "reversed",
        patient_id: "notANumber",
        subject_id: "notANumber",
        subject_type: "needsType",
      },
    });
  });

  it("ignores values a select can't send", () => {
    expect(
      readAuditFilters({
        action: "made.up",
        outcome: "maybe",
        from: "2026-02-31",
      }),
    ).toEqual({
      ok: true,
      filters: {},
    });
  });
});

describe("sameFilters", () => {
  it("compares every filter", () => {
    expect(sameFilters({ patient_id: 12 }, { patient_id: 12 })).toBe(true);
    expect(sameFilters({}, {})).toBe(true);
    expect(sameFilters({ patient_id: 12 }, { patient_id: 13 })).toBe(false);
    expect(sameFilters({ patient_id: 12 }, {})).toBe(false);
  });
});
