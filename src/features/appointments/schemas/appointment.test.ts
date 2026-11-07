import { describe, expect, it } from "vitest";
import {
  appointmentSchema,
  appointmentSummarySchema,
  bookingNoteSchema,
  cancelBody,
  cancelReasonSchema,
  ownAppointmentSchema,
  ownAppointmentSummarySchema,
  toBookingBody,
} from "./appointment";

const summary = {
  id: 7,
  date: "2026-11-08",
  start: "09:20",
  end: "24:00",
  status: "scheduled",
  outside_availability: false,
  doctor: { id: 3, name: "Synthetic Doctor", title: "Consultant" },
  patient: { id: 12, full_name: "Synthetic Patient", phone: "01000000001" },
};
const own = {
  id: 7,
  date: "2026-11-08",
  start: "09:20",
  end: "09:40",
  status: "no_show",
  outside_availability: true,
  patient: {
    id: 12,
    full_name: "Synthetic Patient",
    sex: "female",
    date_of_birth: "1990-04-12",
  },
};
const text = { noteTooLong: "note", reasonTooLong: "reason" };

describe("response schemas", () => {
  it("reads a list row, keeping the end of the day as sent", () => {
    expect(appointmentSummarySchema.parse(summary).end).toBe("24:00");
  });

  it("reads a whole appointment, where history can be absent", () => {
    const parsed = appointmentSchema.parse({
      ...summary,
      note: null,
      booked_by: null,
      booked_at: "2026-11-05T14:22:31.000000Z",
      rescheduled_by: null,
      rescheduled_at: null,
      status_changed_by: { id: 1, name: "Synthetic Staff" },
      status_changed_at: "2026-11-05T14:22:31.000000Z",
      cancellation_reason: null,
    });
    expect(parsed.booked_by).toBeNull();
    expect(parsed.status_changed_by?.name).toBe("Synthetic Staff");
  });

  it("refuses a status the API doesn't define", () => {
    expect(
      appointmentSummarySchema.safeParse({ ...summary, status: "lost" })
        .success,
    ).toBe(false);
  });

  it("reads a doctor's own rows, which have no phone", () => {
    expect(ownAppointmentSummarySchema.parse(own).patient).not.toHaveProperty(
      "phone",
    );
    expect(
      ownAppointmentSchema.parse({
        ...own,
        note: "First visit",
        booked_at: "2026-11-05T14:22:31.000000Z",
      }).note,
    ).toBe("First visit");
  });
});

describe("a booking's note", () => {
  const schema = bookingNoteSchema(text);

  it("is trimmed, and allows 500 characters", () => {
    expect(schema.parse({ note: "  First visit " }).note).toBe("First visit");
    expect(schema.safeParse({ note: "x".repeat(500) }).success).toBe(true);
  });

  it("refuses 501", () => {
    expect(schema.safeParse({ note: "x".repeat(501) }).success).toBe(false);
  });

  it("is left out of the body when empty, and the end is never sent", () => {
    const choice = { patient_id: 12, doctor_id: 3 };
    const time = { date: "2026-11-08", start: "09:20" };
    expect(toBookingBody({ ...choice, ...time, note: "" })).toEqual({
      ...choice,
      ...time,
    });
    expect(toBookingBody({ ...choice, ...time, note: "First visit" })).toEqual({
      ...choice,
      ...time,
      note: "First visit",
    });
  });
});

describe("a cancellation's reason", () => {
  const schema = cancelReasonSchema(text);

  it("allows 255 characters, and refuses 256", () => {
    expect(schema.safeParse({ reason: "x".repeat(255) }).success).toBe(true);
    expect(schema.safeParse({ reason: "x".repeat(256) }).success).toBe(false);
  });

  it("is left out of the body when empty", () => {
    expect(cancelBody("")).toEqual({});
    expect(cancelBody("Patient travelling")).toEqual({
      reason: "Patient travelling",
    });
  });
});
