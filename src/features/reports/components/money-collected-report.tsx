"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/states/empty-state";
import { ClinicDate } from "@/components/shared/values/clinic-date";
import { Money } from "@/components/shared/values/money";
import { UserText } from "@/components/shared/values/user-text";
import { ON_DEMAND_QUERY } from "@/lib/api/live-query";
import { useLiveList } from "@/lib/api/use-live-list";
import { readMoneyCollected } from "../api/reports";
import { REPORTS_ROOT_KEY, reportKey } from "../query-keys";
import type { MoneyCollected, MoneyFigures } from "../types";
import { FigureList } from "./figure-list";
import { MoneyByDayChart } from "./money-by-day-chart";
import type { ReportChoicesProps } from "./report-choices";
import { ReportFrame } from "./report-frame";
import { SignedMoney } from "./values";

type Day = MoneyCollected["by_day"][number];
type StaffMember = MoneyCollected["by_method"][number]["staff"][number];

/** Received, refunded, and net, for the period, by day, and by method with staff (User Story 1). */
export function MoneyCollectedReport({
  choices,
  timeZone,
}: {
  choices: ReportChoicesProps;
  timeZone: string;
}) {
  const locale = useLocale();
  const { from, to, doctorId } = choices.filters;
  const list = useLiveList<MoneyCollected>({
    rootKey: REPORTS_ROOT_KEY,
    // Not paged, so a page in the address is no new read.
    queryKey: reportKey("money-collected", { from, to, doctorId, page: 1 }),
    policy: ON_DEMAND_QUERY,
    read: () => readMoneyCollected({ from, to, doctorId }, locale),
  });

  return (
    <ReportFrame list={list} choices={choices} timeZone={timeZone}>
      {(report) => (
        <MoneyCollectedFigures report={report} doctorId={doctorId} />
      )}
    </ReportFrame>
  );
}

function moneyFigures(
  t: ReturnType<typeof useTranslations<"reports.money">>,
  figures: MoneyFigures,
) {
  return [
    {
      id: "received",
      label: t("received"),
      value: <Money value={figures.received} />,
    },
    {
      id: "refunded",
      label: t("refunded"),
      value: <Money value={figures.refunded} />,
    },
    { id: "net", label: t("net"), value: <SignedMoney value={figures.net} /> },
  ];
}

export function MoneyCollectedFigures({
  report,
  doctorId,
}: {
  report: MoneyCollected;
  doctorId: number | null;
}) {
  const t = useTranslations("reports.money");
  const tMethod = useTranslations("shared.paymentMethod");

  const moneyColumns = <Row extends MoneyFigures>(): DataTableColumn<Row>[] => [
    {
      id: "received",
      header: t("received"),
      cell: (row) => <Money value={row.received} />,
    },
    {
      id: "refunded",
      header: t("refunded"),
      cell: (row) => <Money value={row.refunded} />,
    },
    {
      id: "net",
      header: t("net"),
      cell: (row) => <SignedMoney value={row.net} />,
    },
  ];
  const dayColumns: DataTableColumn<Day>[] = [
    {
      id: "date",
      header: t("date"),
      cell: (row) => <ClinicDate value={row.date} />,
    },
    ...moneyColumns<Day>(),
  ];
  const staffColumns: DataTableColumn<StaffMember>[] = [
    {
      id: "name",
      header: t("staff"),
      cell: (row) => <UserText>{row.name}</UserText>,
    },
    ...moneyColumns<StaffMember>(),
  ];
  const everyNetZero = report.by_day.every((day) => /^-?0+\.00$/.test(day.net));

  return (
    <div className="flex flex-col gap-6">
      <FigureList
        heading={t("totals")}
        figures={moneyFigures(t, report.totals)}
      />
      {doctorId !== null ? (
        <p className="text-muted-foreground">{t("doctorNote")}</p>
      ) : null}

      {report.by_day.length === 0 ? (
        <EmptyState title={t("emptyTitle")} />
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold">{t("byDay")}</h2>
            {everyNetZero ? (
              <p className="text-muted-foreground">{t("noNetChange")}</p>
            ) : (
              <MoneyByDayChart
                from={report.from}
                to={report.to}
                byDay={report.by_day}
              />
            )}
            <DataTable
              caption={t("byDayCaption")}
              columns={dayColumns}
              rows={report.by_day}
              getRowKey={(row) => row.date}
              state="ready"
            />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold">{t("byMethod")}</h2>
            {report.by_method.map((method) => (
              <section key={method.method} className="flex flex-col gap-3">
                <FigureList
                  heading={tMethod(method.method)}
                  level={3}
                  figures={moneyFigures(t, method)}
                />
                <DataTable
                  caption={t("staffCaption", {
                    method: tMethod(method.method),
                  })}
                  columns={staffColumns}
                  rows={method.staff}
                  getRowKey={(row) => String(row.id)}
                  state="ready"
                />
              </section>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
