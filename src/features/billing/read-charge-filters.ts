import { readPositiveId } from "@/lib/api/read-positive-id";
import { addDays } from "@/lib/format/clinic-today";
import { readDateRange } from "@/lib/format/date-range";
import {
  CHARGE_STATUSES,
  type ChargeFilters,
  type ChargeStatus,
} from "./types";

/** The API's limit, both ends included, shared with appointments. */
const MAX_DAYS = 92;
/** Today and the six days before it (clarification 4). */
const DEFAULT_DAYS = 7;

const isStatus = (value: string | undefined): value is ChargeStatus =>
  CHARGE_STATUSES.some((status) => status === value);

/**
 * Charges' address, ignoring what can't be valid. One date alone means that day, as the API requires both. A range
 * the API would refuse is reported, so the page can say so without reading (research R9).
 */
export function readChargeFilters(
  query: {
    from?: string | undefined;
    to?: string | undefined;
    patient_id?: string | undefined;
    doctor_id?: string | undefined;
    status?: string | undefined;
    page?: string | undefined;
  },
  today: string,
): ChargeFilters {
  const { from, to, problem } = readDateRange(query, {
    maxDays: MAX_DAYS,
    defaultRange: { from: addDays(today, -(DEFAULT_DAYS - 1)), to: today },
    oneDate: "same-day",
  });
  const patientId =
    query.patient_id === undefined ? null : readPositiveId(query.patient_id);

  return {
    from,
    to,
    patientId,
    doctorId:
      query.doctor_id === undefined ? null : readPositiveId(query.doctor_id),
    status: isStatus(query.status) ? query.status : null,
    page: (query.page && readPositiveId(query.page)) || 1,
    // One date alone is that day here, so the range can't be missing an end.
    rangeProblem:
      problem === "reversed" || problem === "too_long" ? problem : null,
    patientProblem: query.patient_id !== undefined && patientId === null,
  };
}
