"use client";

import { useTranslations } from "next-intl";
import {
  DataTable,
  type DataTableColumn,
  type DataTablePagination,
} from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Instant } from "@/components/shared/values/instant";
import { LtrText } from "@/components/shared/values/ltr-text";
import { UserText } from "@/components/shared/values/user-text";
import { Button } from "@/components/ui/button";
import { PatientLink } from "@/features/patients/public";
import { Link } from "@/lib/i18n/navigation";
import type { DoctorGroup } from "../group-by-doctor";
import {
  type EntryAction,
  offeredEntryActions,
} from "../offered-entry-actions";
import type { QueueEntry } from "../types";
import { EntryTimes } from "./entry-times";
import { TimeRange } from "@/components/shared/values/time-range";

/** Found again when a dialog closes, as a refresh may have replaced the button or removed it. */
export const actionMarker = (entryId: number, action: EntryAction) =>
  `${entryId}-${action}`;

/** One doctor's rows, in the API's order. A number is a label given on arrival, and never a position. */
export function QueueGroup({
  group,
  timeZone,
  onAction,
  pagination,
}: {
  group: DoctorGroup;
  timeZone: string;
  onAction: (entry: QueueEntry, action: EntryAction) => void;
  /** On the last group only, as the API's pages aren't per doctor. */
  pagination?: DataTablePagination | undefined;
}) {
  const t = useTranslations("queue");

  const columns: DataTableColumn<QueueEntry>[] = [
    {
      id: "number",
      header: t("fields.number"),
      cell: (row) => <LtrText>{row.queue_number}</LtrText>,
    },
    {
      id: "patient",
      header: t("fields.patient"),
      cell: (row) => (
        <div className="flex flex-col">
          <PatientLink id={row.patient.id}>
            <UserText>{row.patient.full_name}</UserText>
          </PatientLink>
          <span className="text-[0.8125rem] text-muted-foreground">
            <LtrText>{row.patient.id}</LtrText>
            {" · "}
            <LtrText>{row.patient.phone}</LtrText>
          </span>
        </div>
      ),
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
          <Link
            href={`/appointments/${row.appointment.id}`}
            prefetch={false}
            className="font-medium underline underline-offset-4"
          >
            <TimeRange
              start={row.appointment.start}
              end={row.appointment.end}
            />
          </Link>
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
      id: "actions",
      header: t("fields.actions"),
      cell: (row) => {
        const offered = offeredEntryActions(row);
        return offered.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {offered.map((action) => (
              <Button
                key={action}
                type="button"
                variant="outline"
                size="sm"
                data-entry-action={actionMarker(row.id, action)}
                onClick={() => onAction(row, action)}
              >
                {t(action === "undo" ? "undo.action" : "left.action")}
              </Button>
            ))}
          </div>
        ) : null;
      },
    },
  ];

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-base font-semibold">
        <UserText>{group.doctor.name}</UserText>
        <span className="font-normal text-muted-foreground">
          {" · "}
          <UserText>{group.doctor.title}</UserText>
        </span>
      </h3>
      <DataTable
        caption={t("caption", { doctor: group.doctor.name })}
        columns={columns}
        rows={group.entries}
        getRowKey={(row) => String(row.id)}
        state="ready"
        pagination={pagination}
      />
    </section>
  );
}
