"use client";

import { useLocale, useTranslations } from "next-intl";
import type { DataTableColumn } from "@/components/shared/data-table";
import { Money } from "@/components/shared/values/money";
import { ON_DEMAND_QUERY } from "@/lib/api/live-query";
import { useLiveList } from "@/lib/api/use-live-list";
import { readBillingReport } from "../api/reports";
import { REPORTS_ROOT_KEY, reportKey } from "../query-keys";
import type {
  BillingFigures,
  BillingRow,
  ReportFilters,
  ReportPage,
} from "../types";
import { DoctorTable } from "./doctor-table";
import { type Figure, FigureList } from "./figure-list";
import type { ReportChoicesProps } from "./report-choices";
import { ReportFrame } from "./report-frame";
import { Count, CountNeedingAttention } from "./values";

type Page = ReportPage<BillingRow, BillingFigures>;

/** Shown as "Charges by doctor", as the desk screen is already "Billing" (clarification 3). */
export function BillingReport({
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
    queryKey: reportKey("billing", { from, to, doctorId, page }),
    policy: ON_DEMAND_QUERY,
    read: () => readBillingReport({ from, to, doctorId, page }, locale),
  });

  return (
    <ReportFrame list={list} choices={choices} timeZone={timeZone}>
      {(report) => (
        <BillingFiguresView report={report} filters={choices.filters} />
      )}
    </ReportFrame>
  );
}

/** The eight figures in order, for the totals and for each doctor's row alike. */
function useBillingFigures() {
  const t = useTranslations("reports.billing");
  return [
    {
      id: "active_charges",
      label: t("activeCharges"),
      value: (f: BillingFigures) => <Count value={f.active_charges} />,
    },
    {
      id: "fees",
      label: t("fees"),
      value: (f: BillingFigures) => <Money value={f.fees} />,
    },
    {
      id: "discounts",
      label: t("discounts"),
      value: (f: BillingFigures) => <Money value={f.discounts} />,
    },
    {
      id: "amount_due",
      label: t("amountDue"),
      value: (f: BillingFigures) => <Money value={f.amount_due} />,
    },
    {
      id: "amount_paid",
      label: t("amountPaid"),
      value: (f: BillingFigures) => <Money value={f.amount_paid} />,
    },
    {
      id: "balance",
      label: t("balance"),
      value: (f: BillingFigures) => <Money value={f.balance} />,
    },
    {
      id: "cancelled_charges",
      label: t("cancelledCharges"),
      value: (f: BillingFigures) => <Count value={f.cancelled_charges} />,
    },
    {
      id: "uncharged_seen_visits",
      label: t("unchargedSeenVisits"),
      value: (f: BillingFigures) => (
        <CountNeedingAttention value={f.uncharged_seen_visits} />
      ),
    },
  ];
}

export function BillingFiguresView({
  report,
  filters,
}: {
  report: Page;
  filters: ReportFilters;
}) {
  const t = useTranslations("reports");
  const figures = useBillingFigures();
  const totals: Figure[] = figures.map(({ id, label, value }) => ({
    id,
    label,
    value: value(report.totals),
  }));
  const columns: DataTableColumn<BillingRow>[] = figures.map(
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
      <p className="text-muted-foreground">{t("billing.note")}</p>
      <DoctorTable
        report="billing"
        filters={filters}
        caption={t("billing.caption")}
        columns={columns}
        rows={report.data}
        meta={report.meta}
        emptyTitle={t("billing.emptyTitle")}
      />
    </div>
  );
}
