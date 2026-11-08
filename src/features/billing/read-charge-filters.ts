import { readPositiveId } from "@/lib/api/read-positive-id";
import { readClinicDate } from "@/lib/format/clinic-date";
import { addDays } from "@/lib/format/clinic-today";
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

/** Days from `from` to `to`, both included. Dates in UTC, so that no daylight-saving change can shift one. */
function daysIncluding(from: string, to: string): number {
  const day = (date: string) => {
    const [year = 0, month = 1, dayOfMonth = 1] = date.split("-").map(Number);
    return Date.UTC(year, month - 1, dayOfMonth) / 86_400_000;
  };
  return day(to) - day(from) + 1;
}

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
  const givenFrom = readClinicDate(query.from);
  const givenTo = readClinicDate(query.to);
  const from = givenFrom ?? givenTo ?? addDays(today, -(DEFAULT_DAYS - 1));
  const to = givenTo ?? givenFrom ?? today;
  const days = daysIncluding(from, to);
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
    rangeProblem: days < 1 ? "reversed" : days > MAX_DAYS ? "too_long" : null,
    patientProblem: query.patient_id !== undefined && patientId === null,
  };
}
