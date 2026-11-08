import type { ApiError } from "./api-error";

/** Roadmap decision Q4. */
export const LIVE_INTERVAL_MS = 15_000;

/**
 * Once, for no answer or a server error. A `4xx` has been decided by the API, and the next tick is the real
 * retry. Actions never come here.
 */
export function retryLiveRead(failures: number, error: ApiError): boolean {
  return failures < 1 && (error.status === 0 || error.status >= 500);
}

/**
 * How a list that must stay current reads itself (ADR 0013). It keeps reading while it's visible, so **a read
 * the backend audits must never use this**: each one writes a permanent entry that nobody asked for (ADR 0005).
 * Check a new use against the backend's audit list first.
 *
 * `networkMode: "always"` is there because the default quietly pauses when the browser says it's offline, which
 * would hide that the list has gone out of date.
 */
export const LIVE_QUERY = {
  staleTime: 0,
  refetchInterval: LIVE_INTERVAL_MS,
  refetchIntervalInBackground: false,
  networkMode: "always",
  retry: retryLiveRead,
} as const;

/**
 * A list that reads in the browser, but never by itself: when it's opened, when its query changes, after an action,
 * and when the person asks (ADR 0015). Billing uses it for any date but today, so that one table has one way of
 * reading. The same audit rule applies as for `LIVE_QUERY`.
 */
export const ON_DEMAND_QUERY = {
  staleTime: 0,
  refetchInterval: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  networkMode: "always",
  retry: retryLiveRead,
} as const;

export type ListPolicy = typeof LIVE_QUERY | typeof ON_DEMAND_QUERY;
