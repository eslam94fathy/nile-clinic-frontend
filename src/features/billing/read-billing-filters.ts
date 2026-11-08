import { readPositiveId } from "@/lib/api/read-positive-id";
import { readClinicDate } from "@/lib/format/clinic-date";
import {
  type BillingFilters,
  VISIT_CHARGE_STATUSES,
  type VisitChargeStatus,
} from "./types";

const isChargeStatus = (
  value: string | undefined,
): value is VisitChargeStatus =>
  VISIT_CHARGE_STATUSES.some((status) => status === value);

/**
 * Billing's address, ignoring what can't be valid, so that an old or edited link shows a list rather than an error.
 * `today` is the clinic's, worked out on the server, as a convenience: the API decides what each date holds.
 */
export function readBillingFilters(
  query: {
    date?: string | undefined;
    doctor_id?: string | undefined;
    charge_status?: string | undefined;
    page?: string | undefined;
  },
  today: string,
): BillingFilters {
  const date = readClinicDate(query.date) ?? today;
  return {
    date,
    isToday: date === today,
    doctorId:
      query.doctor_id === undefined ? null : readPositiveId(query.doctor_id),
    chargeStatus: isChargeStatus(query.charge_status)
      ? query.charge_status
      : null,
    page: (query.page && readPositiveId(query.page)) || 1,
  };
}
