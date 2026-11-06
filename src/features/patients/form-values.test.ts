import { describe, expect, it } from "vitest";
import {
  recordToForm,
  toChanges,
  toChangesSince,
  toRegisterBody,
} from "./form-values";
import type { Patient } from "./types";

const contact = {
  name: "Synthetic Guardian",
  relationship: "father",
  phone: "01000000002",
};
const record: Patient = {
  id: 5,
  full_name: "Synthetic Patient",
  sex: "female",
  date_of_birth: "1990-04-12",
  phone: "01000000001",
  national_id: "29004120100001",
  address: "12 Synthetic St",
  emergency_contact: contact,
  created_at: "2026-02-01T10:00:00.000000Z",
  updated_at: "2026-02-01T10:00:00.000000Z",
};
const sparse: Patient = {
  ...record,
  national_id: null,
  address: null,
  emergency_contact: null,
};
const blankContact = { name: "", relationship: "", phone: "" };

describe("recordToForm", () => {
  it("copies a whole record", () => {
    expect(recordToForm(record)).toEqual({
      full_name: "Synthetic Patient",
      date_of_birth: "1990-04-12",
      sex: "female",
      phone: "01000000001",
      national_id: "29004120100001",
      address: "12 Synthetic St",
      emergency_contact: contact,
    });
  });

  it("turns absent details into empty fields", () => {
    const form = recordToForm(sparse);
    expect(form.national_id).toBe("");
    expect(form.address).toBe("");
    expect(form.emergency_contact).toEqual(blankContact);
  });
});

describe("toRegisterBody", () => {
  const values = recordToForm(sparse);

  it("leaves blank optional details out", () => {
    expect(toRegisterBody(values)).toEqual({
      full_name: "Synthetic Patient",
      date_of_birth: "1990-04-12",
      sex: "female",
      phone: "01000000001",
    });
  });

  it("includes what was given", () => {
    expect(toRegisterBody(recordToForm(record))).toEqual({
      full_name: "Synthetic Patient",
      date_of_birth: "1990-04-12",
      sex: "female",
      phone: "01000000001",
      national_id: "29004120100001",
      address: "12 Synthetic St",
      emergency_contact: contact,
    });
  });

  it("sends a partly filled contact, so the API's answer can show on each part", () => {
    expect(
      toRegisterBody({
        ...values,
        emergency_contact: { ...blankContact, name: "Synthetic Guardian" },
      }).emergency_contact,
    ).toEqual({ ...blankContact, name: "Synthetic Guardian" });
  });
});

describe("toChanges", () => {
  const unchanged = recordToForm(record);

  it("returns nothing when nothing differs", () => {
    expect(toChanges(unchanged, record)).toEqual({});
    expect(toChanges(recordToForm(sparse), sparse)).toEqual({});
  });

  it("returns only what differs", () => {
    expect(toChanges({ ...unchanged, phone: "01000000009" }, record)).toEqual({
      phone: "01000000009",
    });
  });

  it("doesn't count separators or Arabic digits as a change to a phone", () => {
    expect(toChanges({ ...unchanged, phone: "010 0000 0001" }, record)).toEqual(
      {},
    );
    expect(toChanges({ ...unchanged, phone: "٠١٠٠٠٠٠٠٠٠١" }, record)).toEqual(
      {},
    );
  });

  it("doesn't count surrounding spaces as a change", () => {
    expect(
      toChanges(
        {
          ...unchanged,
          full_name: "  Synthetic Patient ",
          address: " 12 Synthetic St ",
        },
        record,
      ),
    ).toEqual({});
  });

  it("doesn't count Arabic digits as a change to a national ID", () => {
    expect(
      toChanges({ ...unchanged, national_id: "٢٩٠٠٤١٢٠١٠٠٠٠١" }, record),
    ).toEqual({});
  });

  it("clears an emptied optional detail with null", () => {
    expect(
      toChanges({ ...unchanged, national_id: "", address: "  " }, record),
    ).toEqual({ national_id: null, address: null });
  });

  it("sends a blank optional detail only if one was recorded", () => {
    expect(toChanges(recordToForm(sparse), sparse)).toEqual({});
  });

  it("sends a contact whole when any part differs", () => {
    expect(
      toChanges(
        {
          ...unchanged,
          emergency_contact: { ...contact, relationship: "brother" },
        },
        record,
      ),
    ).toEqual({ emergency_contact: { ...contact, relationship: "brother" } });
  });

  it("clears a contact with null when all three parts are blank", () => {
    expect(
      toChanges({ ...unchanged, emergency_contact: blankContact }, record),
    ).toEqual({ emergency_contact: null });
  });

  it("makes no change when no contact was recorded and none is given", () => {
    expect(
      toChanges(
        { ...recordToForm(sparse), emergency_contact: blankContact },
        sparse,
      ),
    ).toEqual({});
  });

  it("adds a contact where none was recorded", () => {
    expect(
      toChanges(
        { ...recordToForm(sparse), emergency_contact: contact },
        sparse,
      ),
    ).toEqual({ emergency_contact: contact });
  });
});

describe("collapsed spaces in a name", () => {
  it("are no change, as the API stores it collapsed", () => {
    expect(
      toChanges(
        { ...recordToForm(record), full_name: " Synthetic   Patient " },
        record,
      ),
    ).toEqual({});
  });

  it("are sent collapsed, along with a real change", () => {
    expect(
      toChanges(
        { ...recordToForm(record), full_name: "Synthetic   Renamed" },
        record,
      ),
    ).toEqual({ full_name: "Synthetic Renamed" });
  });
});

describe("toChangesSince", () => {
  const colleague: Patient = { ...record, phone: "01000000077" };

  it("leaves out a field only a colleague changed", () => {
    expect(
      toChangesSince(
        { ...recordToForm(record), address: "New St" },
        record,
        colleague,
      ),
    ).toEqual({ address: "New St" });
  });

  it("sends a field this person changed, over a colleague's value", () => {
    expect(
      toChangesSince(
        { ...recordToForm(record), phone: "01000000088" },
        record,
        colleague,
      ),
    ).toEqual({ phone: "01000000088" });
  });

  it("leaves out a change that already matches the newest record", () => {
    expect(
      toChangesSince(
        { ...recordToForm(record), phone: "01000000077" },
        record,
        colleague,
      ),
    ).toEqual({});
  });

  it("leaves out a contact a colleague added, when this person left it blank", () => {
    expect(
      toChangesSince(recordToForm(sparse), sparse, {
        ...sparse,
        emergency_contact: contact,
      }),
    ).toEqual({});
  });
});
