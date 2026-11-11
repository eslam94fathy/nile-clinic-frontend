import { describe, expect, it } from "vitest";
import { describeValue } from "./describe-value";

describe("describeValue", () => {
  it.each([
    [
      "appointment",
      "status",
      "no_show",
      { kind: "status", group: "appointment", value: "no_show" },
    ],
    [
      "visit",
      "status",
      "with_doctor",
      { kind: "status", group: "queue", value: "with_doctor" },
    ],
    [
      "encounter",
      "status",
      "finalized",
      { kind: "status", group: "record", value: "finalized" },
    ],
    [
      "charge",
      "status",
      "partially_paid",
      { kind: "status", group: "charge", value: "partially_paid" },
    ],
    [
      "staff_member",
      "role",
      "receptionist",
      { kind: "role", value: "receptionist" },
    ],
    ["staff_member", "is_active", false, { kind: "active", value: false }],
    ["specialty", "is_active", true, { kind: "active", value: true }],
    ["charge", "fee", "350.00", { kind: "money", value: "350.00" }],
    ["charge", "discount", "200.00", { kind: "money", value: "200.00" }],
    [
      "charge",
      "amount_paid",
      "1234567.89",
      { kind: "money", value: "1234567.89" },
    ],
    ["doctor", "fee", "500.00", { kind: "money", value: "500.00" }],
    [
      "appointment",
      "date",
      "2026-11-05",
      { kind: "date", value: "2026-11-05" },
    ],
    ["appointment", "start_minute", 540, { kind: "time", value: "09:00" }],
    ["appointment", "end_minute", 1440, { kind: "time", value: "24:00" }],
    ["appointment", "doctor_id", 7, { kind: "number", value: 7 }],
    ["visit", "doctor_id", 7, { kind: "number", value: 7 }],
  ] as const)("%s %s %s", (subject, field, value, described) => {
    expect(describeValue(subject, field, value)).toEqual(described);
  });

  it("keeps money exactly as sent, never as a number", () => {
    const described = describeValue("charge", "fee", "0.10");
    expect(described).toEqual({ kind: "money", value: "0.10" });
  });

  it.each([null, undefined])("describes %s as none", (value) => {
    expect(describeValue("charge", "fee", value)).toEqual({ kind: "none" });
  });

  it.each([
    ["money as a number", "charge", "fee", 200, "200"],
    [
      "a status on a record type without one",
      "patient",
      "status",
      "seen",
      "seen",
    ],
    ["a role elsewhere", "doctor", "role", "doctor", "doctor"],
    ["a minute out of range", "appointment", "start_minute", 1500, "1500"],
    [
      "a date that isn't real",
      "appointment",
      "date",
      "2026-02-31",
      "2026-02-31",
    ],
    ["an unknown field", "charge", "something_new", "x", "x"],
    ["a flag as text", "staff_member", "is_active", "1", "1"],
    [
      "a non-scalar",
      "doctor",
      "periods",
      [{ weekday: "sunday" }],
      '[{"weekday":"sunday"}]',
    ],
    ["no record type", null, "status", "paid", "paid"],
  ] as const)("shows %s as sent", (_, subject, field, value, text) => {
    expect(describeValue(subject, field, value)).toEqual({
      kind: "asSent",
      value: text,
    });
  });
});
