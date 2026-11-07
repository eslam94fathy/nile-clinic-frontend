import { addDays } from "@/lib/format/clinic-today";

const DAYS_SHOWN = 7;
/** The API's limit: free times can't be asked for further ahead than this. */
const HORIZON_DAYS = 90;

export type FreeTimeWindow = {
  from: string;
  to: string;
  /** Where the previous week starts, if there is one. */
  previous?: string;
  /** Where the next week starts, if there is one. */
  next?: string;
};

/**
 * Seven days from a date, kept between the clinic's today and the API's limit, so that a date typed outside
 * them is never requested. Clinic dates in this format compare correctly as strings.
 */
export function freeTimeWindow(wanted: string, today: string): FreeTimeWindow {
  const horizon = addDays(today, HORIZON_DAYS);
  const from = wanted < today ? today : wanted > horizon ? horizon : wanted;
  const end = addDays(from, DAYS_SHOWN - 1);
  const to = end > horizon ? horizon : end;

  const back = addDays(from, -DAYS_SHOWN);
  return {
    from,
    to,
    ...(from > today ? { previous: back < today ? today : back } : {}),
    ...(to < horizon ? { next: addDays(from, DAYS_SHOWN) } : {}),
  };
}
