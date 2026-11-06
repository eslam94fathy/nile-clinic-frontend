import { useTranslations } from "next-intl";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/states/empty-state";
import { ClinicDate } from "@/components/shared/values/clinic-date";
import { ClinicTime } from "@/components/shared/values/clinic-time";
import { NoValue } from "@/components/shared/values/no-value";
import { UserText } from "@/components/shared/values/user-text";
import type { TimeOff } from "../types";
import { RemoveTimeOff } from "./remove-time-off";

/**
 * Removing is only offered while the end date hasn't passed. An entry that ended earlier today gets the
 * API's refusal, as that depends on the API's clock.
 */
export function TimeOffList({
  entries,
  today,
  removableBy,
}: {
  entries: TimeOff[];
  /** The clinic's today, written as a date, so that comparing the text compares the dates. */
  today: string;
  /** The doctor's id, when this person may remove entries. */
  removableBy?: number;
}) {
  const t = useTranslations("scheduling");

  const columns: DataTableColumn<TimeOff>[] = [
    {
      id: "dates",
      header: t("dates"),
      cell: (row) =>
        row.start_date === row.end_date ? (
          <ClinicDate value={row.start_date} />
        ) : (
          <>
            <ClinicDate value={row.start_date} />
            {" – "}
            <ClinicDate value={row.end_date} />
          </>
        ),
    },
    {
      id: "times",
      header: t("times"),
      cell: (row) =>
        row.start_time === null ? (
          t("wholeDays")
        ) : (
          <>
            <ClinicTime value={row.start_time} />
            {" – "}
            <ClinicTime value={row.end_time} />
          </>
        ),
    },
    {
      id: "reason",
      header: t("reason"),
      cell: (row) =>
        row.reason ? <UserText>{row.reason}</UserText> : <NoValue />,
    },
  ];

  if (removableBy !== undefined) {
    columns.push({
      id: "actions",
      header: t("actions"),
      cell: (row) =>
        row.end_date < today ? (
          <NoValue />
        ) : (
          <RemoveTimeOff doctorId={removableBy} timeOffId={row.id} />
        ),
    });
  }

  return (
    <DataTable
      caption={t("timeOffCaption")}
      columns={columns}
      rows={entries}
      getRowKey={(row) => String(row.id)}
      state={entries.length === 0 ? "empty" : "ready"}
      emptyState={<EmptyState title={t("timeOffEmptyTitle")} />}
    />
  );
}
