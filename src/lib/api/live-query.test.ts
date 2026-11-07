import { describe, expect, it } from "vitest";
import { LIVE_QUERY, retryLiveRead } from "./live-query";

const failure = (status: number) => ({ status, fieldErrors: {} });

describe("the live policy", () => {
  it("reads every 15 seconds, only while visible, and always counts as stale", () => {
    expect(LIVE_QUERY.refetchInterval).toBe(15_000);
    expect(LIVE_QUERY.refetchIntervalInBackground).toBe(false);
    expect(LIVE_QUERY.staleTime).toBe(0);
  });

  it("fails visibly, rather than pausing when the browser says it's offline", () => {
    expect(LIVE_QUERY.networkMode).toBe("always");
  });

  it.each([0, 500, 502, 503])("retries %i once", (status) => {
    expect(retryLiveRead(0, failure(status))).toBe(true);
    expect(retryLiveRead(1, failure(status))).toBe(false);
  });

  it.each([400, 401, 403, 404, 409, 422])("never retries %i", (status) => {
    expect(retryLiveRead(0, failure(status))).toBe(false);
  });
});
