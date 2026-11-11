"use client";

import { useLocale } from "next-intl";
import type { ApiResult } from "@/lib/api/api-error";
import type { ListPolicy } from "@/lib/api/live-query";
import { type LiveList, useLiveList } from "@/lib/api/use-live-list";
import { clinicToday } from "@/lib/format/clinic-today";
import { panelKey } from "./query-keys";

/**
 * One panel's read (ADR 0019). Today is worked out each time it runs, in the clinic's time zone, so a page left open
 * past midnight reads the new day (research R6). The panel's own key is also its refresh's, so Refresh and Try again
 * read only this panel (spec US4).
 */
export function usePanel<Data>({
  panel,
  read,
  timeZone,
  policy,
}: {
  panel: string;
  read: (today: string, locale: string) => Promise<ApiResult<Data>>;
  timeZone: string;
  policy: ListPolicy;
}): LiveList<Data> {
  const locale = useLocale();
  const key = panelKey(panel);

  return useLiveList<Data>({
    rootKey: key,
    queryKey: [...key, locale],
    policy,
    read: () => read(clinicToday(timeZone), locale),
  });
}
