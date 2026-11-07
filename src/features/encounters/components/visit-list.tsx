import { useTranslations } from "next-intl";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { FilterBar } from "@/components/shared/filter-bar";
import { FormError } from "@/components/shared/form/form-error";
import { EmptyState } from "@/components/shared/states/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { ClinicDate } from "@/components/shared/values/clinic-date";
import { Instant } from "@/components/shared/values/instant";
import { LtrText } from "@/components/shared/values/ltr-text";
import { UserText } from "@/components/shared/values/user-text";
import { ApiFailureState } from "@/features/auth/public";
import type { ApiResult } from "@/lib/api/api-error";
import { type PageMeta, pageHref } from "@/lib/api/pagination";
import { RECORD_STATUSES, type Visit, type VisitFilters } from "../types";
import { RecordAction } from "./record-action";
import { TodaysPatientsProvider, VisitHistoryLink } from "./todays-patients";

const FILTER_FIELDS = new Set(["from", "to", "record_status"]);

/**
 * A doctor's visits, with no clinical content, as the API sends. Order is the API's, with no sorting (gap G4). Nothing
 * here reads a record, until a person follows a row's link.
 */
export function VisitList({
  result,
  filters,
  timeZone,
}: {
  result: ApiResult<{ data: Visit[]; meta: PageMeta }>;
  filters: VisitFilters;
  timeZone: string;
}) {
  const t = useTranslations("encounters.visits");
  const tRoot = useTranslations("encounters");
  const tStatus = useTranslations("shared.status.record");
  const tShared = useTranslations("shared.form");

  if (!result.ok && result.error.status !== 422) {
    return <ApiFailureState error={result.error} />;
  }

  const fieldErrors = result.ok ? {} : result.error.fieldErrors;
  const errors = Object.fromEntries(
    Object.entries(fieldErrors)
      .filter(([key]) => FILTER_FIELDS.has(key))
      .map(([key, messages]) => [key, messages.join(" ")]),
  );
  const others = Object.entries(fieldErrors)
    .filter(([key]) => !FILTER_FIELDS.has(key))
    .flatMap(([, messages]) => messages);
  const refusals = result.ok
    ? []
    : others.length > 0 || Object.keys(errors).length > 0
      ? others
      : [result.error.message ?? tShared("generalFailure")];

  const columns: DataTableColumn<Visit>[] = [
    {
      id: "date",
      header: t("date"),
      cell: (row) => <ClinicDate value={row.date} />,
    },
    {
      id: "patient",
      header: t("patient"),
      cell: (row) => (
        <div className="flex flex-col">
          <UserText>{row.patient.full_name}</UserText>
          <span className="text-[0.8125rem] text-muted-foreground">
            <LtrText>{row.patient.id}</LtrText>
            {" · "}
            {tRoot(`sex.${row.patient.sex}`)}
            {" · "}
            <ClinicDate value={row.patient.date_of_birth} />
          </span>
        </div>
      ),
    },
    {
      id: "kind",
      header: t("kind"),
      cell: (row) => t(row.walk_in ? "walkIn" : "booked"),
    },
    {
      id: "times",
      header: t("times"),
      cell: (row) => (
        <div className="flex flex-col text-[0.8125rem]">
          <span>
            {t("arrived")}{" "}
            <Instant value={row.arrived_at} timeZone={timeZone} />
          </span>
          {row.called_at ? (
            <span>
              {t("called")}{" "}
              <Instant value={row.called_at} timeZone={timeZone} />
            </span>
          ) : null}
          {row.finished_at ? (
            <span>
              {t("finished")}{" "}
              <Instant value={row.finished_at} timeZone={timeZone} />
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "record",
      header: t("recordStatus"),
      cell: (row) => <StatusBadge kind="record" value={row.record_status} />,
    },
    {
      id: "action",
      header: t("action"),
      cell: (row) => (
        <div className="flex flex-col items-start gap-1">
          <RecordAction
            visitId={row.id}
            status={row.record_status}
            encounterId={row.encounter_id}
          />
          <VisitHistoryLink
            recordStatus={row.record_status}
            patientId={row.patient.id}
            patientName={row.patient.full_name}
          />
        </div>
      ),
    },
  ];

  return (
    <TodaysPatientsProvider>
      <FilterBar
        errors={errors}
        filters={[
          {
            name: "from",
            label: t("from"),
            type: "date",
            inAddress: true,
            defaultValue: filters.from,
          },
          {
            name: "to",
            label: t("to"),
            type: "date",
            inAddress: true,
            defaultValue: filters.to,
          },
          {
            name: "record_status",
            label: t("recordStatus"),
            type: "select",
            inAddress: true,
            options: [
              { value: "", label: t("anyStatus") },
              ...RECORD_STATUSES.map((status) => ({
                value: status,
                label: tStatus(status),
              })),
            ],
          },
        ]}
      />
      <FormError messages={refusals} />
      {result.ok ? (
        <DataTable
          caption={t("caption")}
          columns={columns}
          rows={result.data.data}
          getRowKey={(row) => String(row.id)}
          state={result.data.meta.total === 0 ? "empty" : "ready"}
          emptyState={
            <EmptyState
              title={t("emptyTitle")}
              description={t("emptyDescription")}
            />
          }
          pagination={{
            page: result.data.meta.current_page,
            lastPage: result.data.meta.last_page,
            total: result.data.meta.total,
            hrefForPage: pageHref("/my/visits", {
              from: filters.from,
              to: filters.to,
              record_status: filters.record_status,
            }),
          }}
        />
      ) : null}
    </TodaysPatientsProvider>
  );
}
