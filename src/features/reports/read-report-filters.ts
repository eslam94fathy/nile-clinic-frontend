import { readPositiveId } from "@/lib/api/read-positive-id";
import { startOfMonth } from "@/lib/format/clinic-today";
import { readDateRange } from "@/lib/format/date-range";
import type { ReportFilters } from "./types";

/** The API's limit, both ends included. */
export const MAX_REPORT_DAYS = 366;

/**
 * A report's choices from the address, ignoring what can't be valid. With no dates, this month to today in the
 * clinic's calendar (clarification 1). One date alone is a problem rather than a guess, and so is a period the API
 * would refuse: nothing is read until it's corrected (research R3).
 */
export function readReportFilters(
  query: {
    from?: string | undefined;
    to?: string | undefined;
    doctor_id?: string | undefined;
    page?: string | undefined;
  },
  today: string,
): ReportFilters {
  const { from, to, problem, given } = readDateRange(query, {
    maxDays: MAX_REPORT_DAYS,
    defaultRange: { from: startOfMonth(today), to: today },
    oneDate: "missing",
  });

  return {
    from,
    to,
    doctorId:
      query.doctor_id === undefined ? null : readPositiveId(query.doctor_id),
    page: (query.page && readPositiveId(query.page)) || 1,
    rangeProblem: problem,
    isDefaultPeriod: !given,
  };
}
