"use client";

import { useLocale, useTranslations } from "next-intl";
import type { DataTableColumn } from "@/components/shared/data-table";
import { ON_DEMAND_QUERY } from "@/lib/api/live-query";
import { useLiveList } from "@/lib/api/use-live-list";
import { readTimesReport } from "../api/reports";
import { REPORTS_ROOT_KEY, reportKey } from "../query-keys";
import type {
  ReportFilters,
  ReportPage,
  TimesFigures,
  TimesRow,
} from "../types";
import { DoctorTable } from "./doctor-table";
import { type Figure, FigureList } from "./figure-list";
import type { ReportChoicesProps } from "./report-choices";
import { ReportFrame } from "./report-frame";
import { AverageMinutes, Count, CountNeedingAttention } from "./values";

type Page = ReportPage<TimesRow, TimesFigures>;

/** Average wait and consultation, and seen visits by record state, with no clinical content (User Story 5). */
export function TimesReport({
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
    queryKey: reportKey("times", { from, to, doctorId, page }),
    policy: ON_DEMAND_QUERY,
    read: () => readTimesReport({ from, to, doctorId, page }, locale),
  });

  return (
    <ReportFrame list={list} choices={choices} timeZone={timeZone}>
      {(report) => (
        <TimesFiguresView report={report} filters={choices.filters} />
      )}
    </ReportFrame>
  );
}

function useTimesFigures() {
  const t = useTranslations("reports");
  const tRecord = useTranslations("shared.status.record");
  const seen = t("times.records");
  const inGroup = (item: string) => t("columnInGroup", { group: seen, item });

  return [
    {
      id: "wait",
      label: t("times.wait"),
      value: (f: TimesFigures) => (
        <AverageMinutes value={f.wait.average_minutes} visits={f.wait.visits} />
      ),
    },
    {
      id: "consultation",
      label: t("times.consultation"),
      value: (f: TimesFigures) => (
        <AverageMinutes
          value={f.consultation.average_minutes}
          visits={f.consultation.visits}
        />
      ),
    },
    {
      id: "records.finalized",
      label: inGroup(tRecord("finalized")),
      value: (f: TimesFigures) => <Count value={f.records.finalized} />,
    },
    {
      id: "records.draft",
      label: inGroup(tRecord("draft")),
      value: (f: TimesFigures) => (
        <CountNeedingAttention value={f.records.draft} />
      ),
    },
    {
      id: "records.none",
      label: inGroup(tRecord("none")),
      value: (f: TimesFigures) => (
        <CountNeedingAttention value={f.records.none} />
      ),
    },
  ];
}

export function TimesFiguresView({
  report,
  filters,
}: {
  report: Page;
  filters: ReportFilters;
}) {
  const t = useTranslations("reports");
  const figures = useTimesFigures();
  const totals: Figure[] = figures.map(({ id, label, value }) => ({
    id,
    label,
    value: value(report.totals),
  }));
  const columns: DataTableColumn<TimesRow>[] = figures.map(
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
      <p className="text-muted-foreground">{t("times.note")}</p>
      <DoctorTable
        report="times"
        filters={filters}
        caption={t("times.caption")}
        columns={columns}
        rows={report.data}
        meta={report.meta}
        emptyTitle={t("times.emptyTitle")}
      />
    </div>
  );
}
