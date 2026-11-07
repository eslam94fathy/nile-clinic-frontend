"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FilterBar } from "@/components/shared/filter-bar";
import { EmptyState } from "@/components/shared/states/empty-state";
import { ErrorState } from "@/components/shared/states/error-state";
import { LoadingState } from "@/components/shared/states/loading-state";
import { Button } from "@/components/ui/button";
import { ApiFailureState } from "@/features/auth/public";
import type { ApiResult } from "@/lib/api/api-error";
import { type PageMeta, pageHref } from "@/lib/api/pagination";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { readClinicQueue, readDoctorQueue } from "../api/queue";
import { groupByDoctor } from "../group-by-doctor";
import { useLiveList } from "../hooks/use-live-list";
import type { EntryAction } from "../offered-entry-actions";
import { QUEUE_STATUSES, type QueueEntry, type QueueFilters } from "../types";
import {
  EntryActionDialog,
  type EntryActionRequest,
} from "./entry-action-dialog";
import { LastRead } from "./last-read";
import { actionMarker, QueueGroup } from "./queue-group";

type DoctorOption = { id: number; name: string; is_active: boolean };
type ClinicList = { entries: QueueEntry[]; meta: PageMeta | null };

function shownMatching(selector: string): HTMLElement | undefined {
  // The table keeps a copy for narrow screens, so there can be two, with one showing.
  return [...document.querySelectorAll<HTMLElement>(selector)].find(
    (element) => element.offsetParent !== null,
  );
}

/** Reception's list for today. Reads only what the filters need, and never re-sorts (research R6). */
export function ClinicQueue({
  filters,
  doctors,
  timeZone,
}: {
  filters: QueueFilters;
  /** `null` when they couldn't be read: the list still shows, with less to filter by. */
  doctors: DoctorOption[] | null;
  timeZone: string;
}) {
  const locale = useLocale();
  const t = useTranslations("queue");
  const tStatus = useTranslations("shared.status.queue");
  const router = useRouter();
  const { doctorId, status, page } = filters;

  const list = useLiveList<ClinicList>({
    queryKey:
      doctorId === null
        ? ["queue", "clinic", { status, page }]
        : ["queue", "doctor", doctorId],
    read: async (): Promise<ApiResult<ClinicList>> => {
      if (doctorId === null) {
        const result = await readClinicQueue({ status, page }, locale);
        return result.ok
          ? {
              ...result,
              data: { entries: result.data.data, meta: result.data.meta },
            }
          : result;
      }
      const result = await readDoctorQueue(doctorId, locale);
      return result.ok
        ? { ...result, data: { entries: result.data.data, meta: null } }
        : result;
    },
  });

  const heading = useRef<HTMLHeadingElement>(null);
  const focusedEntry = useRef<string | null>(null);
  const [request, setRequest] = useState<EntryActionRequest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const entries =
    doctorId !== null && status !== null
      ? // Complete, as this list isn't paged, so narrowing it here can't mislead.
        (list.data?.entries ?? []).filter((entry) => entry.status === status)
      : (list.data?.entries ?? []);
  const meta = list.data?.meta ?? null;
  const beyondTheEnd =
    meta !== null && entries.length === 0 && meta.current_page > meta.last_page;
  const pageLink = pageHref("/queue", { status: status ?? undefined });
  const shownIds = entries.map(({ id }) => String(id)).join();

  // The list can shrink under someone on a later page. "Nobody here" would be untrue.
  useEffect(() => {
    if (beyondTheEnd) router.replace(pageLink(meta.last_page));
    // `pageLink` is new each render, and is decided by `status`, which the address already follows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beyondTheEnd, meta?.last_page, router, status]);

  // A row that goes while it holds the focus would drop it to the page's start. Nothing moves otherwise.
  useLayoutEffect(() => {
    const id = focusedEntry.current;
    if (id === null || shownIds.split(",").includes(id)) return;
    focusedEntry.current = null;
    if (document.activeElement === document.body) {
      heading.current?.focus({ preventScroll: true });
    }
  }, [shownIds]);

  function requestAction(entry: QueueEntry, action: EntryAction) {
    setRequest({ entry, action });
    setDialogOpen(true);
  }

  function restoreFocus(event: Event) {
    event.preventDefault();
    const button =
      request &&
      shownMatching(
        `[data-entry-action="${actionMarker(request.entry.id, request.action)}"]`,
      );
    (button ?? heading.current)?.focus();
  }

  if (list.failure?.status === 403) {
    return <ApiFailureState error={list.failure} />;
  }

  const emptyActions = (
    <div className="flex flex-wrap justify-center gap-2">
      <Button variant="outline" asChild>
        <Link href="/appointments" prefetch={false}>
          {t("todaysAppointments")}
        </Link>
      </Button>
      <Button variant="outline" asChild>
        <Link href="/queue/walk-in" prefetch={false}>
          {t("addWalkIn")}
        </Link>
      </Button>
    </div>
  );
  const narrowed = doctorId !== null || status !== null;
  const groups = groupByDoctor(entries);

  return (
    <>
      <FilterBar
        filters={[
          {
            name: "doctor_id",
            label: t("fields.doctor"),
            type: "select",
            inAddress: true,
            ...(doctors ? {} : { hint: t("filters.doctorsUnavailable") }),
            options: [
              { value: "", label: t("filters.anyDoctor") },
              ...(doctors
                ? doctors.map((doctor) => ({
                    value: String(doctor.id),
                    label: doctor.is_active
                      ? doctor.name
                      : t("filters.inactiveDoctor", { name: doctor.name }),
                  }))
                : // Without this, a list narrowed to one doctor would look like everyone's.
                  doctorId !== null
                  ? [{ value: String(doctorId), label: String(doctorId) }]
                  : []),
            ],
          },
          {
            name: "status",
            label: t("fields.status"),
            type: "select",
            inAddress: true,
            options: [
              { value: "", label: t("filters.anyStatus") },
              ...QUEUE_STATUSES.map((value) => ({
                value,
                label: tStatus(value),
              })),
            ],
          },
        ]}
      />
      <h2
        ref={heading}
        tabIndex={-1}
        className="text-xl font-semibold outline-none"
      >
        {t("listHeading")}
      </h2>

      {list.failure?.status === 404 ? (
        <div className="flex flex-col items-start gap-3">
          <ApiFailureState error={list.failure} />
          <Button variant="outline" asChild>
            <Link href="/queue" prefetch={false}>
              {t("allDoctors")}
            </Link>
          </Button>
        </div>
      ) : list.failure ? (
        <ErrorState
          message={list.failure.message ?? t("readFailed")}
          onRetry={() => void list.refresh()}
        />
      ) : list.data === undefined || beyondTheEnd ? (
        <LoadingState />
      ) : (
        <>
          <LastRead
            readAt={list.readAt}
            outOfDate={list.outOfDate}
            reading={list.reading}
            onRefresh={() => void list.refresh()}
            timeZone={timeZone}
          />
          {groups.length === 0 ? (
            <EmptyState
              title={t(narrowed ? "empty.filteredTitle" : "empty.todayTitle")}
              description={t(
                narrowed
                  ? "empty.filteredDescription"
                  : "empty.todayDescription",
              )}
              action={emptyActions}
            />
          ) : (
            <div
              className="flex flex-col gap-6"
              onFocusCapture={(event) => {
                focusedEntry.current =
                  event.target
                    .closest("[data-entry-row]")
                    ?.getAttribute("data-entry-row") ?? null;
              }}
              onBlurCapture={(event) => {
                // With nothing receiving it, the row may just have gone, which is what the layout effect is for.
                if (event.relatedTarget !== null) focusedEntry.current = null;
              }}
            >
              {groups.map((group, index) => (
                <QueueGroup
                  key={`${group.doctor.id}-${index}`}
                  group={group}
                  timeZone={timeZone}
                  onAction={requestAction}
                  pagination={
                    meta && index === groups.length - 1
                      ? {
                          page: meta.current_page,
                          lastPage: meta.last_page,
                          total: meta.total,
                          hrefForPage: pageLink,
                        }
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </>
      )}

      <EntryActionDialog
        request={request}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCloseAutoFocus={restoreFocus}
        refresh={list.refresh}
      />
    </>
  );
}
