"use client";

import { type QueryKey, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiError, ApiResult } from "@/lib/api/api-error";
import { LIVE_QUERY } from "@/lib/api/live-query";

/** Every list on screen is under this, so that one action refreshes them all. */
export const QUEUE_ROOT_KEY = ["queue"] as const;

/** The API has decided, and asking again every 15 seconds wouldn't change that. */
const stopsReading = (error: ApiError | null) =>
  error?.status === 403 || error?.status === 404;

export type LiveList<Data> = {
  /** Absent until the first read, and removed by a `403` or `404`. */
  data: Data | undefined;
  /** A failure with nothing to show instead. */
  failure: ApiError | null;
  /** The last list is showing, and the latest read of it failed. */
  outOfDate: boolean;
  reading: boolean;
  /** When the list on screen was read, or 0 before the first. */
  readAt: number;
  /** Also cancels a read in flight, so that an older answer can't replace a newer one. */
  refresh: () => Promise<void>;
};

/**
 * A list that reads itself while it's on screen (ADR 0013). **Only for reads the backend doesn't audit.** Failed
 * reads keep the last list and carry on. A `403` or `404` removes the data and stops, including on returning to
 * the page and on focus, because `enabled` sees the error.
 */
export function useLiveList<Data>({
  queryKey,
  read,
}: {
  queryKey: QueryKey;
  read: () => Promise<ApiResult<Data>>;
}): LiveList<Data> {
  const client = useQueryClient();

  const query = useQuery<Data, ApiError>({
    ...LIVE_QUERY,
    queryKey,
    enabled: ({ state }) => !stopsReading(state.error),
    queryFn: async () => {
      const result = await read();
      if (result.ok) return result.data;

      // Before the error is stored, so that nothing can render this data alongside a refusal.
      if (stopsReading(result.error)) {
        client
          .getQueryCache()
          .find<Data, ApiError>({ queryKey, exact: true })
          ?.setState({ data: undefined, dataUpdatedAt: 0 });
      }
      throw result.error;
    },
  });

  return {
    data: query.data,
    failure: query.data === undefined ? query.error : null,
    outOfDate: query.data !== undefined && query.isError,
    reading: query.isFetching,
    readAt: query.dataUpdatedAt,
    refresh: () => client.invalidateQueries({ queryKey: QUEUE_ROOT_KEY }),
  };
}
