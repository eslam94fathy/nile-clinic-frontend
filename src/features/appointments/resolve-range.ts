import { addDays } from "@/lib/format/clinic-today";
import type { AppointmentFilters } from "./types";

/** Bookings can't be made further ahead, so this covers everything upcoming, and is within the API's 92 days. */
const UPCOMING_DAYS = 90;

/**
 * The dates to read, which are also the dates the filter shows. What's in the address wins. One date alone
 * means that day, as the API requires both. Otherwise a patient or "needing a move" looks at everything
 * upcoming, and the plain list looks at today.
 */
export function resolveRange(
  filters: Pick<
    AppointmentFilters,
    "from" | "to" | "patient_id" | "outside_availability"
  >,
  today: string,
): { from: string; to: string } {
  const from = filters.from || filters.to;
  const to = filters.to || filters.from;
  if (from && to) return { from, to };

  return filters.patient_id || filters.outside_availability
    ? { from: today, to: addDays(today, UPCOMING_DAYS) }
    : { from: today, to: today };
}
