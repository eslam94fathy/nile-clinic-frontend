import { readClinicDate } from "./clinic-date";

export type DateRange = { from: string; to: string };

/** Something the API would refuse, so the range isn't sent at all. */
export type DateRangeProblem =
  "missing_from" | "missing_to" | "reversed" | "too_long";

/** Days from `from` to `to`, both included. Dates in UTC, so that no daylight-saving change can shift one. */
export function daysIncluding(from: string, to: string): number {
  const day = (date: string) => {
    const [year = 0, month = 1, dayOfMonth = 1] = date.split("-").map(Number);
    // Not `Date.UTC(year, …)`, which reads years 0 to 99 as 1900 to 1999.
    const moment = new Date(0);
    moment.setUTCFullYear(year, month - 1, dayOfMonth);
    return moment.getTime() / 86_400_000;
  };
  return day(to) - day(from) + 1;
}

/**
 * A range from an address, ignoring dates that aren't real. With neither date, `defaultRange`. With one date alone,
 * `oneDate` decides: `"same-day"` reads it as that day, `"missing"` reports the other as missing. A range the API
 * would refuse is reported, so a page can say so without reading. Only for faster feedback; the API decides.
 */
export function readDateRange(
  query: { from?: string | undefined; to?: string | undefined },
  options: {
    maxDays: number;
    defaultRange: DateRange;
    oneDate: "same-day" | "missing";
  },
): DateRange & { problem: DateRangeProblem | null; given: boolean } {
  const givenFrom = readClinicDate(query.from);
  const givenTo = readClinicDate(query.to);

  if (givenFrom === null && givenTo === null) {
    return { ...options.defaultRange, problem: null, given: false };
  }
  if (givenFrom === null || givenTo === null) {
    const date = givenFrom ?? givenTo ?? "";
    return {
      from: date,
      to: date,
      problem:
        options.oneDate === "same-day"
          ? null
          : givenFrom === null
            ? "missing_from"
            : "missing_to",
      given: true,
    };
  }

  const days = daysIncluding(givenFrom, givenTo);
  return {
    from: givenFrom,
    to: givenTo,
    problem: days < 1 ? "reversed" : days > options.maxDays ? "too_long" : null,
    given: true,
  };
}
