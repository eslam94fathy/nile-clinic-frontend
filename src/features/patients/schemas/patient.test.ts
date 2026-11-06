import { describe, expect, it } from "vitest";
import {
  type PatientFormText,
  patientFormSchema,
  patientSchema,
  patientSummarySchema,
} from "./patient";

const text: PatientFormText = {
  nameRequired: "name required",
  nameTooLong: "name long",
  dateRequired: "date required",
  dateRange: "date range",
  sexRequired: "sex required",
  phoneRule: "phone rule",
  nationalIdRule: "national id rule",
  addressTooLong: "address long",
  contactPartRequired: "contact part",
  contactNameTooLong: "contact name long",
  relationshipTooLong: "relationship long",
};
const schema = patientFormSchema(text, "2026-11-06");

const valid = {
  full_name: "Synthetic Patient",
  date_of_birth: "1990-04-12",
  sex: "female",
  phone: "01000000001",
  national_id: "",
  address: "",
  emergency_contact: { name: "", relationship: "", phone: "" },
};

function messagesFor(values: object) {
  const result = schema.safeParse({ ...valid, ...values });
  return result.success ? [] : result.error.issues.map((i) => i.message);
}

describe("patientFormSchema", () => {
  it("accepts required details alone", () => {
    expect(messagesFor({})).toEqual([]);
  });

  it("requires a name that isn't blank, of at most 255", () => {
    expect(messagesFor({ full_name: "   " })).toEqual([text.nameRequired]);
    expect(messagesFor({ full_name: "a".repeat(255) })).toEqual([]);
    expect(messagesFor({ full_name: "a".repeat(256) })).toEqual([
      text.nameTooLong,
    ]);
  });

  it("leaves a stored name's letters and digits alone", () => {
    const parsed = schema.parse({ ...valid, full_name: " أحمد ٣ " });
    expect(parsed.full_name).toBe("أحمد ٣");
  });

  it("keeps the date of birth between 130 years ago and the clinic's today", () => {
    expect(messagesFor({ date_of_birth: "" })).toEqual([text.dateRequired]);
    expect(messagesFor({ date_of_birth: "2026-11-06" })).toEqual([]);
    expect(messagesFor({ date_of_birth: "2026-11-07" })).toEqual([
      text.dateRange,
    ]);
    expect(messagesFor({ date_of_birth: "1896-11-06" })).toEqual([]);
    expect(messagesFor({ date_of_birth: "1896-11-05" })).toEqual([
      text.dateRange,
    ]);
  });

  it("requires a sex, with no default", () => {
    expect(messagesFor({ sex: "" })).toEqual([text.sexRequired]);
    expect(messagesFor({ sex: "male" })).toEqual([]);
  });

  it.each([
    ["010 0000 0001", "01000000001"],
    ["010-0000-0001", "01000000001"],
    ["(010) 00000001", "01000000001"],
    ["+201000000001", "+201000000001"],
    ["٠١٠٠٠٠٠٠٠٠١", "01000000001"],
  ])("normalises the phone %s", (typed, sent) => {
    expect(schema.parse({ ...valid, phone: typed }).phone).toBe(sent);
  });

  it.each(["", "1234567", "1234567890123456", "01x000000", "++0100000000"])(
    "refuses the phone %s",
    (phone) => {
      expect(messagesFor({ phone })).toEqual([text.phoneRule]);
    },
  );

  it("checks a national ID only when there is one", () => {
    expect(messagesFor({ national_id: "29004120100001" })).toEqual([]);
    expect(messagesFor({ national_id: "39004120100001" })).toEqual([]);
    expect(messagesFor({ national_id: "19004120100001" })).toEqual([
      text.nationalIdRule,
    ]);
    expect(messagesFor({ national_id: "2900412010000" })).toEqual([
      text.nationalIdRule,
    ]);
    expect(
      schema.parse({ ...valid, national_id: "٢٩٠٠٤١٢٠١٠٠٠٠١" }).national_id,
    ).toBe("29004120100001");
  });

  it("limits the address to 500", () => {
    expect(messagesFor({ address: "a".repeat(500) })).toEqual([]);
    expect(messagesFor({ address: "a".repeat(501) })).toEqual([
      text.addressTooLong,
    ]);
  });

  it("needs all three parts of an emergency contact, or none", () => {
    const result = schema.safeParse({
      ...valid,
      emergency_contact: {
        name: "Synthetic Guardian",
        relationship: "",
        phone: "",
      },
    });
    expect(result.success).toBe(false);
    expect(
      result.error?.issues.map((issue) => issue.path.join(".")).sort(),
    ).toEqual(["emergency_contact.phone", "emergency_contact.relationship"]);
  });

  it("checks each part of an emergency contact", () => {
    expect(
      messagesFor({
        emergency_contact: {
          name: "a".repeat(256),
          relationship: "a".repeat(51),
          phone: "12",
        },
      }).sort(),
    ).toEqual(
      [
        text.contactNameTooLong,
        text.relationshipTooLong,
        text.phoneRule,
      ].sort(),
    );
  });

  it("normalises the emergency contact's phone", () => {
    const parsed = schema.parse({
      ...valid,
      emergency_contact: {
        name: "Synthetic Guardian",
        relationship: "father",
        phone: "٠١٠ ٠٠٠٠ ٠٠٠٢",
      },
    });
    expect(parsed.emergency_contact.phone).toBe("01000000002");
  });
});

describe("response schemas", () => {
  const summary = {
    id: 5,
    full_name: "Synthetic Patient",
    sex: "male",
    date_of_birth: "1990-04-12",
    phone: "01000000001",
  };

  it("accepts the list's five fields", () => {
    expect(patientSummarySchema.parse(summary)).toEqual(summary);
  });

  it("accepts a whole record, with absent optional details", () => {
    const record = {
      ...summary,
      national_id: null,
      address: null,
      emergency_contact: null,
      created_at: "2026-02-01T10:00:00.000000Z",
      updated_at: "2026-02-01T10:00:00.000000Z",
    };
    expect(patientSchema.parse(record)).toEqual(record);
  });

  it("refuses a record with no number", () => {
    expect(patientSchema.safeParse({ full_name: "x" }).success).toBe(false);
  });
});
