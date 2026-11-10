import type { Report, ReportFilters } from "./types";

/** Every report read is under this, so Refresh never touches another feature's lists (ADR 0016). */
export const REPORTS_ROOT_KEY = ["reports"] as const;

/** One report for one set of choices: a change of choice is a new read, and Refresh rereads only what's on screen. */
export function reportKey(
  report: Report,
  {
    from,
    to,
    doctorId,
    page,
  }: Pick<ReportFilters, "from" | "to" | "doctorId" | "page">,
) {
  return [...REPORTS_ROOT_KEY, report, { from, to, doctorId, page }] as const;
}
