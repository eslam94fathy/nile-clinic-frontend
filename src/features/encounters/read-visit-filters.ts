import { addDays } from "@/lib/format/clinic-today";
import { RECORD_STATUSES, type RecordStatus, type VisitFilters } from "./types";

/** Long enough to catch forgotten records, and well inside the API's 92 days. */
const DEFAULT_DAYS = 30;

const isRealDate = (value: string | undefined): value is string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  // With its zone stated, so that this can't move a day.
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
};

const isStatus = (value: string | undefined): value is RecordStatus =>
  RECORD_STATUSES.some((status) => status === value);

/**
 * The address to what's read, ignoring what can't be valid, and never throwing. One date alone means that day, as
 * the API requires both. A range that's too long is sent anyway, as the API's answer says so better than this could.
 */
export function readVisitFilters(
  query: {
    from?: string | undefined;
    to?: string | undefined;
    record_status?: string | undefined;
    page?: string | undefined;
  },
  today: string,
): VisitFilters {
  const given = {
    from: isRealDate(query.from) ? query.from : undefined,
    to: isRealDate(query.to) ? query.to : undefined,
  };
  const from = given.from ?? given.to ?? addDays(today, -DEFAULT_DAYS);
  const to = given.to ?? given.from ?? today;
  const page = /^[1-9]\d*$/.test(query.page ?? "")
    ? Number(query.page)
    : undefined;

  return {
    from,
    to,
    ...(isStatus(query.record_status)
      ? { record_status: query.record_status }
      : {}),
    ...(page ? { page } : {}),
  };
}
