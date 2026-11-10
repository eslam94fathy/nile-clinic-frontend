import type { DateRange } from "@/lib/format/date-range";
import type { Report, ReportFilters } from "./types";

/**
 * A report's address. Only dates, a doctor's number, and a page ever go in it (FR-006). The dates are left out for
 * the default period, so it keeps moving with the clinic's calendar. A page belongs to one report, so it's only
 * passed by that report's own page links.
 */
export function reportHref(
  report: Report,
  {
    period,
    doctorId,
    page,
  }: {
    period: Partial<DateRange> | null;
    doctorId: number | null;
    page?: number;
  },
): string {
  const query = new URLSearchParams();
  if (period?.from) query.set("from", period.from);
  if (period?.to) query.set("to", period.to);
  if (doctorId !== null) query.set("doctor_id", String(doctorId));
  if (page !== undefined && page > 1) query.set("page", String(page));
  const text = query.toString();
  return text ? `/reports/${report}?${text}` : `/reports/${report}`;
}

/**
 * The period as the address had it: `null` for the default one, and only the date given when the other is missing,
 * so that moving to another report keeps the problem rather than quietly choosing one day.
 */
export function periodOf(
  filters: Pick<
    ReportFilters,
    "from" | "to" | "isDefaultPeriod" | "rangeProblem"
  >,
): Partial<DateRange> | null {
  if (filters.isDefaultPeriod) return null;
  if (filters.rangeProblem === "missing_to") return { from: filters.from };
  if (filters.rangeProblem === "missing_from") return { to: filters.to };
  return { from: filters.from, to: filters.to };
}
