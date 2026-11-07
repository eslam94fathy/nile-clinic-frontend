"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/states/empty-state";
import { ErrorState } from "@/components/shared/states/error-state";
import { LoadingState } from "@/components/shared/states/loading-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { ClinicDate } from "@/components/shared/values/clinic-date";
import { Instant } from "@/components/shared/values/instant";
import { LtrText } from "@/components/shared/values/ltr-text";
import { UserText } from "@/components/shared/values/user-text";
import { ApiFailureState } from "@/features/auth/public";
import { useRouter } from "@/lib/i18n/navigation";
import { readOwnQueue } from "../api/queue";
import { applyEntry } from "../apply-entry";
import { useLiveList } from "../hooks/use-live-list";
import type { OwnQueueEntry } from "../types";
import { EntryTimes } from "./entry-times";
import { LastRead } from "./last-read";
import { OwnQueueActions } from "./own-queue-actions";
import { TimeRange } from "./time-range";

const OWN_QUEUE_KEY = ["queue", "own"];
const HEADING_ID = "own-queue-heading";

/**
 * A doctor's list for today. It shows only what the API sends for a doctor, with no phone, and has no links, as
 * medical records arrive in Phase 8 and doctors have no patient pages.
 */
export function OwnQueue({ timeZone }: { timeZone: string }) {
  const locale = useLocale();
  const t = useTranslations("queue");
  const router = useRouter();
  const client = useQueryClient();

  const list = useLiveList<{ data: OwnQueueEntry[] }>({
    queryKey: OWN_QUEUE_KEY,
    read: () => readOwnQueue(locale),
  });
  const failure = list.failure?.status;

  // A profile that's gone is the gate's to explain, once the page has read it again.
  useEffect(() => {
    if (failure === 404) router.refresh();
  }, [failure, router]);

  if (failure === 403 || failure === 404) {
    return list.failure ? <ApiFailureState error={list.failure} /> : null;
  }
  if (list.failure) {
    return (
      <ErrorState
        message={list.failure.message ?? t("readFailed")}
        onRetry={() => void list.refresh()}
      />
    );
  }
  if (!list.data) return <LoadingState />;

  const entries = list.data.data;
  const current = entries.find(({ status }) => status === "with_doctor");
  const others = entries.filter((entry) => entry !== current);
  const anyoneWaiting = entries.some(({ status }) => status === "waiting");

  const columns: DataTableColumn<OwnQueueEntry>[] = [
    {
      id: "number",
      header: t("fields.number"),
      cell: (row) => <LtrText>{row.queue_number}</LtrText>,
    },
    {
      id: "patient",
      header: t("fields.patient"),
      cell: (row) => <PatientSummary patient={row.patient} />,
    },
    {
      id: "status",
      header: t("fields.status"),
      cell: (row) => <StatusBadge kind="queue" value={row.status} />,
    },
    {
      id: "appointment",
      header: t("fields.appointment"),
      cell: (row) =>
        row.appointment ? (
          <TimeRange start={row.appointment.start} end={row.appointment.end} />
        ) : (
          t("walkIn")
        ),
    },
    {
      id: "arrived",
      header: t("fields.arrived"),
      cell: (row) => <Instant value={row.arrived_at} timeZone={timeZone} />,
    },
    {
      id: "times",
      header: t("fields.times"),
      cell: (row) => <EntryTimes entry={row} timeZone={timeZone} />,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h2
        id={HEADING_ID}
        tabIndex={-1}
        className="text-xl font-semibold outline-none"
      >
        {t("own.listHeading")}
      </h2>
      {current ? (
        <section
          aria-label={t("own.currentHeading")}
          className="flex flex-col gap-2 rounded-lg border p-4"
        >
          <h3 className="text-base font-semibold">{t("own.currentHeading")}</h3>
          <PatientSummary patient={current.patient} />
          <div className="flex flex-wrap items-center gap-3 text-[0.8125rem] text-muted-foreground">
            <span>
              {t("fields.number")} <LtrText>{current.queue_number}</LtrText>
            </span>
            <EntryTimes entry={current} timeZone={timeZone} />
          </div>
        </section>
      ) : null}
      <OwnQueueActions
        entries={entries}
        headingId={HEADING_ID}
        onAnswered={(answer) => {
          // Not a read, so the last-read time stays as it was.
          client.setQueryData<{ data: OwnQueueEntry[] }>(
            OWN_QUEUE_KEY,
            (old) => old && { data: applyEntry(old.data, answer) },
            { updatedAt: list.readAt },
          );
        }}
        refresh={list.refresh}
      />
      <LastRead
        readAt={list.readAt}
        outOfDate={list.outOfDate}
        reading={list.reading}
        onRefresh={() => void list.refresh()}
        timeZone={timeZone}
      />
      {entries.length === 0 ? (
        <EmptyState
          title={t("own.emptyTitle")}
          description={t("own.emptyDescription")}
        />
      ) : !current && !anyoneWaiting ? (
        <p className="text-muted-foreground">{t("own.nobodyWaiting")}</p>
      ) : null}
      {others.length > 0 ? (
        <DataTable
          caption={t("own.caption")}
          columns={columns}
          rows={others}
          getRowKey={(row) => String(row.id)}
          state="ready"
        />
      ) : null}
    </div>
  );
}

function PatientSummary({ patient }: { patient: OwnQueueEntry["patient"] }) {
  const t = useTranslations("queue");

  return (
    <div className="flex flex-col">
      <span className="font-medium">
        <UserText>{patient.full_name}</UserText>
      </span>
      <span className="text-[0.8125rem] text-muted-foreground">
        <LtrText>{patient.id}</LtrText>
        {" · "}
        {t(`sex.${patient.sex}`)}
        {" · "}
        <ClinicDate value={patient.date_of_birth} />
      </span>
    </div>
  );
}
