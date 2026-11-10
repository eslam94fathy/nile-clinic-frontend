"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/states/empty-state";
import { UserText } from "@/components/shared/values/user-text";
import type { PageMeta } from "@/lib/api/pagination";
import { useRouter } from "@/lib/i18n/navigation";
import { periodOf, reportHref } from "../report-href";
import type { Report, ReportDoctor, ReportFilters } from "../types";

/** The doctor as stored: the name, then the title when there is one. Neither is translated. */
export function doctorColumn<Row extends { doctor: ReportDoctor }>(
  header: string,
): DataTableColumn<Row> {
  return {
    id: "doctor",
    header,
    cell: (row) => (
      <div className="flex flex-col">
        <UserText>{row.doctor.name}</UserText>
        {row.doctor.title ? (
          <span className="text-[0.8125rem] text-muted-foreground">
            <UserText>{row.doctor.title}</UserText>
          </span>
        ) : null}
      </div>
    ),
  };
}

/**
 * One page of doctors, in the API's order, with page links that keep the period and doctor. A page past the last is
 * replaced with the last, as Billing does, since "nothing here" would be untrue (spec, Edge Cases).
 */
export function DoctorTable<Row extends { doctor: ReportDoctor }>({
  report,
  filters,
  caption,
  columns,
  rows,
  meta,
  emptyTitle,
}: {
  report: Report;
  filters: ReportFilters;
  caption: string;
  columns: DataTableColumn<Row>[];
  rows: Row[];
  meta: PageMeta;
  emptyTitle: string;
}) {
  const t = useTranslations("reports");
  const router = useRouter();
  const period = periodOf(filters);
  const pageLink = (page: number) =>
    reportHref(report, { period, doctorId: filters.doctorId, page });
  const beyondTheEnd =
    rows.length === 0 && meta.total > 0 && meta.current_page > meta.last_page;
  const lastPageLink = pageLink(meta.last_page);

  useEffect(() => {
    if (beyondTheEnd) router.replace(lastPageLink);
  }, [beyondTheEnd, lastPageLink, router]);

  if (beyondTheEnd) return null;
  if (rows.length === 0) return <EmptyState title={emptyTitle} />;

  return (
    <DataTable
      caption={caption}
      columns={[doctorColumn<Row>(t("doctorColumn")), ...columns]}
      rows={rows}
      getRowKey={(row) => String(row.doctor.id)}
      state="ready"
      pagination={{
        page: meta.current_page,
        lastPage: meta.last_page,
        total: meta.total,
        hrefForPage: pageLink,
      }}
    />
  );
}
