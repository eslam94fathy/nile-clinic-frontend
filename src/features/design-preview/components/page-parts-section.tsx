import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import type { FilterDefinition } from "@/components/shared/filter-bar";
import { EmptyState } from "@/components/shared/states/empty-state";
import { ErrorState } from "@/components/shared/states/error-state";
import { LoadingState } from "@/components/shared/states/loading-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { ClinicTime } from "@/components/shared/values/clinic-time";
import { LtrText } from "@/components/shared/values/ltr-text";
import { Money } from "@/components/shared/values/money";
import { UserText } from "@/components/shared/values/user-text";
import { type SampleVisit, sampleVisits } from "../synthetic-data";
import { FilterBarDemo } from "./filter-bar-demo";
import { PreviewSection } from "./preview-section";

export async function PagePartsSection({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "preview.list" });
  const states = await getTranslations({
    locale,
    namespace: "preview.states",
  });
  const queue = await getTranslations({
    locale,
    namespace: "shared.status.queue",
  });

  const columns: DataTableColumn<SampleVisit>[] = [
    { id: "number", header: t("number"), cell: (row) => row.number },
    {
      id: "patient",
      header: t("patient"),
      cell: (row) => <UserText>{row.name}</UserText>,
    },
    {
      id: "phone",
      header: t("phone"),
      cell: (row) => <LtrText>{row.phone}</LtrText>,
    },
    {
      id: "doctor",
      header: t("doctor"),
      cell: (row) => <UserText>{row.doctor}</UserText>,
    },
    {
      id: "time",
      header: t("time"),
      cell: (row) => <ClinicTime value={row.time} />,
    },
    {
      id: "visit",
      header: t("visit"),
      cell: (row) => <StatusBadge kind="queue" value={row.visit} />,
    },
    {
      id: "charge",
      header: t("charge"),
      cell: (row) => <StatusBadge kind="charge" value={row.charge} />,
    },
    {
      id: "balance",
      header: t("balance"),
      cell: (row) => <Money value={row.balance} />,
    },
  ];

  const filters: FilterDefinition[] = [
    {
      name: "status",
      label: t("filterStatus"),
      type: "select",
      inAddress: true,
      options: [
        { value: "", label: t("filterAll") },
        { value: "waiting", label: queue("waiting") },
        { value: "seen", label: queue("seen") },
      ],
    },
    { name: "date", label: t("filterDate"), type: "date", inAddress: true },
    {
      name: "search",
      label: t("filterSearch"),
      hint: t("filterSearchHint"),
      type: "text",
      inAddress: false,
    },
  ];

  const table = {
    columns,
    rows: sampleVisits,
    getRowKey: (row: SampleVisit) => row.id,
  };

  return (
    <PreviewSection heading={t("heading")}>
      <Suspense fallback={<LoadingState />}>
        <FilterBarDemo
          filters={filters}
          privateFilter="search"
          appliedLabel={t.markup("appliedSearch", { value: "{value}" })}
        />
      </Suspense>
      <DataTable
        {...table}
        caption={t("caption")}
        state="ready"
        pagination={{
          page: 2,
          lastPage: 3,
          total: 42,
          hrefForPage: (page) => `/design-preview?page=${page}`,
        }}
      />
      <h3 className="font-semibold">{t("loadingHeading")}</h3>
      <DataTable {...table} caption={t("loadingCaption")} state="loading" />
      <h3 className="font-semibold">{t("emptyHeading")}</h3>
      <DataTable
        {...table}
        caption={t("emptyCaption")}
        state="empty"
        emptyState={
          <EmptyState
            title={states("emptyNoMatches")}
            description={states("emptyNoMatchesDescription")}
          />
        }
      />
      <h3 className="font-semibold">{t("errorHeading")}</h3>
      <DataTable
        {...table}
        caption={t("errorCaption")}
        state="error"
        errorState={<ErrorState message={states("errorMessage")} />}
      />
    </PreviewSection>
  );
}
