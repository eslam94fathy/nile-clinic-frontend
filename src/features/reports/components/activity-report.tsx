"use client";

import { useLocale, useTranslations } from "next-intl";
import type { DataTableColumn } from "@/components/shared/data-table";
import { ON_DEMAND_QUERY } from "@/lib/api/live-query";
import { useLiveList } from "@/lib/api/use-live-list";
import { readActivityReport } from "../api/reports";
import { REPORTS_ROOT_KEY, reportKey } from "../query-keys";
import type {
  ActivityFigures,
  ActivityRow,
  ActivityTotals,
  ReportFilters,
  ReportPage,
} from "../types";
import { DoctorTable } from "./doctor-table";
import { type Figure, FigureList } from "./figure-list";
import type { ReportChoicesProps } from "./report-choices";
import { ReportFrame } from "./report-frame";
import { Count, NoShowRate } from "./values";

type Page = ReportPage<ActivityRow, ActivityTotals>;

const APPOINTMENT_STATUSES = [
  "scheduled",
  "cancelled",
  "no_show",
  "checked_in",
  "completed",
] as const satisfies readonly (keyof ActivityFigures["appointments"])[];
const VISIT_STATUSES = [
  "waiting",
  "with_doctor",
  "seen",
  "left",
] as const satisfies readonly (keyof ActivityFigures["visits"])[];

/** Appointments, the no-show rate, visits, and new patients (User Story 4). */
export function ActivityReport({
  choices,
  timeZone,
}: {
  choices: ReportChoicesProps;
  timeZone: string;
}) {
  const locale = useLocale();
  const { from, to, doctorId, page } = choices.filters;
  const list = useLiveList<Page>({
    rootKey: REPORTS_ROOT_KEY,
    queryKey: reportKey("activity", { from, to, doctorId, page }),
    policy: ON_DEMAND_QUERY,
    read: () => readActivityReport({ from, to, doctorId, page }, locale),
  });

  return (
    <ReportFrame list={list} choices={choices} timeZone={timeZone}>
      {(report) => (
        <ActivityFiguresView report={report} filters={choices.filters} />
      )}
    </ReportFrame>
  );
}

/** Each figure with a label naming its group, as a table header has no group above it. */
function useActivityFigures() {
  const t = useTranslations("reports");
  const tAppointment = useTranslations("shared.status.appointment");
  const tVisit = useTranslations("shared.status.queue");
  const inGroup = (group: string, item: string) =>
    t("columnInGroup", { group, item });
  const appointments = t("activity.appointments");
  const visits = t("activity.visits");

  return [
    ...APPOINTMENT_STATUSES.map((status) => ({
      id: `appointments.${status}`,
      label: inGroup(appointments, tAppointment(status)),
      value: (f: ActivityFigures) => <Count value={f.appointments[status]} />,
    })),
    {
      id: "no_show_rate",
      label: t("activity.noShowRate"),
      value: (f: ActivityFigures) => <NoShowRate value={f.no_show_rate} />,
    },
    ...VISIT_STATUSES.map((status) => ({
      id: `visits.${status}`,
      label: inGroup(visits, tVisit(status)),
      value: (f: ActivityFigures) => <Count value={f.visits[status]} />,
    })),
    {
      id: "visits.booked",
      label: inGroup(visits, t("activity.booked")),
      value: (f: ActivityFigures) => <Count value={f.visits.booked} />,
    },
    {
      id: "visits.walk_in",
      label: inGroup(visits, t("activity.walkIn")),
      value: (f: ActivityFigures) => <Count value={f.visits.walk_in} />,
    },
  ];
}

export function ActivityFiguresView({
  report,
  filters,
}: {
  report: Page;
  filters: ReportFilters;
}) {
  const t = useTranslations("reports");
  const figures = useActivityFigures();
  const newPatients = report.totals.new_patients;
  const totals: Figure[] = [
    ...figures.map(({ id, label, value }) => ({
      id,
      label,
      value: value(report.totals),
    })),
    // Absent, not zero, when a doctor is chosen: the API counts the whole clinic.
    ...(newPatients === undefined
      ? []
      : [
          {
            id: "new_patients",
            label: t("activity.newPatients"),
            value: <Count value={newPatients} />,
          },
        ]),
  ];
  const columns: DataTableColumn<ActivityRow>[] = figures.map(
    ({ id, label, value }) => ({ id, header: label, cell: value }),
  );

  return (
    <div className="flex flex-col gap-4">
      <FigureList
        heading={
          // One doctor's totals are only theirs; the period line above names them.
          filters.doctorId === null ? t("allDoctors") : t("thisDoctor")
        }
        figures={totals}
      />
      {newPatients === undefined ? (
        <p className="text-muted-foreground">
          {t("activity.newPatientsForClinic")}
        </p>
      ) : null}
      <p className="text-muted-foreground">{t("activity.rateNote")}</p>
      <DoctorTable
        report="activity"
        filters={filters}
        caption={t("activity.caption")}
        columns={columns}
        rows={report.data}
        meta={report.meta}
        emptyTitle={t("activity.emptyTitle")}
      />
    </div>
  );
}
