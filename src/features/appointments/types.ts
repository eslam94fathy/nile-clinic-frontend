import type { components } from "@/lib/api/generated/appointments";

export type AppointmentStatus = components["schemas"]["Status"];
export type AppointmentSummary = components["schemas"]["AppointmentSummary"];
export type Appointment = components["schemas"]["Appointment"];
export type OwnAppointmentSummary =
  components["schemas"]["OwnAppointmentSummary"];
export type OwnAppointment = components["schemas"]["OwnAppointment"];
export type BookingInput = components["schemas"]["BookingInput"];
export type RescheduleInput = components["schemas"]["RescheduleInput"];

/** Each list's query, as read from the page's address. A patient only ever appears as a number. */
export type AppointmentFilters = {
  from?: string | undefined;
  to?: string | undefined;
  doctor_id?: string | undefined;
  patient_id?: string | undefined;
  status?: string | undefined;
  outside_availability?: string | undefined;
  page?: string | undefined;
};

export type OwnAppointmentFilters = {
  from?: string | undefined;
  to?: string | undefined;
  status?: string | undefined;
  page?: string | undefined;
};

export const APPOINTMENT_STATUSES = [
  "scheduled",
  "cancelled",
  "no_show",
  "checked_in",
  "completed",
] as const satisfies readonly AppointmentStatus[];
