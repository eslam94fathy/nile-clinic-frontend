import "server-only";
import { itemSchema, pageSchema } from "@/lib/api/pagination";
import { readResource, toQuery } from "@/lib/api/read-resource";
import {
  appointmentSchema,
  appointmentSummarySchema,
  ownAppointmentSchema,
  ownAppointmentSummarySchema,
} from "../schemas/appointment";
import type { AppointmentFilters, OwnAppointmentFilters } from "../types";

// None of these is audited, so they can be read on the server and refreshed freely (ADR 0011).

export function readAppointments(locale: string, filters: AppointmentFilters) {
  return readResource(
    `appointments${toQuery(filters)}`,
    locale,
    pageSchema(appointmentSummarySchema),
  );
}

export function readAppointment(locale: string, id: number) {
  return readResource(
    `appointments/${id}`,
    locale,
    itemSchema(appointmentSchema),
  );
}

export function readOwnAppointments(
  locale: string,
  filters: OwnAppointmentFilters,
) {
  return readResource(
    `doctors/me/appointments${toQuery(filters)}`,
    locale,
    pageSchema(ownAppointmentSummarySchema),
  );
}

export function readOwnAppointment(locale: string, id: number) {
  return readResource(
    `doctors/me/appointments/${id}`,
    locale,
    itemSchema(ownAppointmentSchema),
  );
}
