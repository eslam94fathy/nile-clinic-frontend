import { z } from "zod";
import {
  APPOINTMENT_STATUSES,
  type Appointment,
  type AppointmentSummary,
  type BookingInput,
  type OwnAppointment,
  type OwnAppointmentSummary,
} from "../types";

const statusSchema = z.enum(APPOINTMENT_STATUSES);
const staffRefSchema = z
  .object({ id: z.number(), name: z.string() })
  .nullable();

export const appointmentSummarySchema = z.object({
  id: z.number(),
  date: z.string(),
  start: z.string(),
  end: z.string(),
  status: statusSchema,
  outside_availability: z.boolean(),
  doctor: z.object({ id: z.number(), name: z.string(), title: z.string() }),
  patient: z.object({
    id: z.number(),
    full_name: z.string(),
    phone: z.string(),
  }),
}) satisfies z.ZodType<AppointmentSummary>;

export const appointmentSchema = appointmentSummarySchema.extend({
  note: z.string().nullable(),
  booked_by: staffRefSchema,
  booked_at: z.string(),
  rescheduled_by: staffRefSchema,
  rescheduled_at: z.string().nullable(),
  status_changed_by: staffRefSchema,
  status_changed_at: z.string().nullable(),
  cancellation_reason: z.string().nullable(),
}) satisfies z.ZodType<Appointment>;

export const ownAppointmentSummarySchema = z.object({
  id: z.number(),
  date: z.string(),
  start: z.string(),
  end: z.string(),
  status: statusSchema,
  outside_availability: z.boolean(),
  patient: z.object({
    id: z.number(),
    full_name: z.string(),
    sex: z.enum(["male", "female"]),
    date_of_birth: z.string(),
  }),
}) satisfies z.ZodType<OwnAppointmentSummary>;

export const ownAppointmentSchema = ownAppointmentSummarySchema.extend({
  note: z.string().nullable(),
  booked_at: z.string(),
}) satisfies z.ZodType<OwnAppointment>;

export function bookingNoteSchema(text: { noteTooLong: string }) {
  return z.object({
    note: z.string().trim().max(500, text.noteTooLong),
  });
}

export function cancelReasonSchema(text: { reasonTooLong: string }) {
  return z.object({
    reason: z.string().trim().max(255, text.reasonTooLong),
  });
}

/** An empty note is no note. The API takes the end from the slot, so it's never sent. */
export function toBookingBody({
  note,
  ...choice
}: {
  patient_id: number;
  doctor_id: number;
  date: string;
  start: string;
  note: string;
}): BookingInput {
  return note ? { ...choice, note } : choice;
}

/** An empty reason is no reason. */
export function cancelBody(reason: string): { reason?: string } {
  return reason ? { reason } : {};
}
