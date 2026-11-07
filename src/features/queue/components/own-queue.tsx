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
import {
  HistoryLink,
  offeredForQueueRow,
  readTodaysVisits,
  RecordAction,
  type Visit,
} from "@/features/encounters/public";
import { clinicToday } from "@/lib/format/clinic-today";
import { useRouter } from "@/lib/i18n/navigation";
import { readOwnQueue } from "../api/queue";
import { applyEntry } from "../apply-entry";
import { useLiveList } from "../hooks/use-live-list";
import type { OwnQueueEntry } from "../types";
import { EntryTimes } from "./entry-times";
import { LastRead } from "./last-read";
import { OwnQueueActions } from "./own-queue-actions";
import { TimeRange } from "@/components/shared/values/time-range";

const OWN_QUEUE_KEY = ["queue", "own"];
const OWN_VISITS_KEY = ["queue", "own-visits"];
const HEADING_ID = "own-queue-heading";

/**
 * A doctor's list for today. It shows only what the API sends for a doctor, with no phone, and no link to a patient's
 * record, as doctors have no patient pages. Queue rows have no record number, so today's visits are read beside them,
 * which isn't audited either (ADR 0013). No record or history is read until a person follows a link.
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
  const visits = useLiveList<{ data: Visit[] }>({
    queryKey: OWN_VISITS_KEY,
    read: () => readTodaysVisits(clinicToday(timeZone), locale),
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
  const visitOf = new Map(visits.data?.data.map((visit) => [visit.id, visit]));
  const refreshAfterRefusal = () => void list.refresh();

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
    {
      id: "record",
      header: t("own.recordHeading"),
      cell: (row) => (
        <RecordCell
          entry={row}
          visit={visitOf.get(row.id)}
          onRefused={refreshAfterRefusal}
        />
      ),
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
      {visits.failure ? (
        <p className="text-[0.8125rem] text-muted-foreground">
          {t("own.recordsUnavailable")}
        </p>
      ) : null}
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
          <RecordCell
            entry={current}
            visit={visitOf.get(current.id)}
            onRefused={refreshAfterRefusal}
          />
        </section>
      ) : null}
      <OwnQueueActions
        entries={entries}
        headingId={HEADING_ID}
        currentRecordStatus={
          current ? visitOf.get(current.id)?.record_status : undefined
        }
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

/**
 * A visit with no match shows no status and no action, rather than guessing there's no record. Waiting patients never
 * match, as the API's list leaves them out, but may still have a history.
 */
function RecordCell({
  entry,
  visit,
  onRefused,
}: {
  entry: OwnQueueEntry;
  visit: Visit | undefined;
  onRefused: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-1">
      {visit ? (
        <>
          <StatusBadge kind="record" value={visit.record_status} />
          <RecordAction
            visitId={visit.id}
            status={visit.record_status}
            encounterId={visit.encounter_id}
            onRefused={onRefused}
          />
        </>
      ) : null}
      {offeredForQueueRow(entry.status) ? (
        <HistoryLink
          patientId={entry.patient.id}
          patientName={entry.patient.full_name}
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
