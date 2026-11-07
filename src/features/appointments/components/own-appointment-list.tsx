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
import { LtrText } from "@/components/shared/values/ltr-text";
import { UserText } from "@/components/shared/values/user-text";
import { ApiFailureState } from "@/features/auth/public";
import type { ApiResult } from "@/lib/api/api-error";
import { type PageMeta, pageHref } from "@/lib/api/pagination";
import { Link } from "@/lib/i18n/navigation";
import {
  APPOINTMENT_STATUSES,
  type OwnAppointmentFilters,
  type OwnAppointmentSummary,
} from "../types";
import { OutsideLabel } from "./outside-label";
import { TimeRange } from "@/components/shared/values/time-range";

const FILTER_FIELDS = new Set(["from", "to", "status"]);

/** Read-only. A doctor sees only what the API sends for them, which has no phone, and has no patient link. */
export function OwnAppointmentList({
  result,
  filters,
  range,
}: {
  result: ApiResult<{ data: OwnAppointmentSummary[]; meta: PageMeta }>;
  filters: OwnAppointmentFilters;
  range: { from: string; to: string };
}) {
  const t = useTranslations("appointments");
  const tStatus = useTranslations("shared.status.appointment");
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

  const columns: DataTableColumn<OwnAppointmentSummary>[] = [
    {
      id: "date",
      header: t("fields.date"),
      cell: (row) => <ClinicDate value={row.date} />,
    },
    {
      id: "time",
      header: t("fields.time"),
      cell: (row) => (
        <Link
          href={`/my/appointments/${row.id}`}
          prefetch={false}
          className="font-medium underline underline-offset-4"
        >
          <TimeRange start={row.start} end={row.end} />
        </Link>
      ),
    },
    {
      id: "patient",
      header: t("fields.patient"),
      cell: (row) => (
        <div className="flex flex-col">
          <UserText>{row.patient.full_name}</UserText>
          <span className="text-[0.8125rem] text-muted-foreground">
            <LtrText>{row.patient.id}</LtrText>
            {" · "}
            {t(`sex.${row.patient.sex}`)}
            {" · "}
            <ClinicDate value={row.patient.date_of_birth} />
          </span>
        </div>
      ),
    },
    {
      id: "status",
      header: t("fields.status"),
      cell: (row) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge kind="appointment" value={row.status} />
          {row.outside_availability ? <OutsideLabel /> : null}
        </div>
      ),
    },
  ];

  const narrowed = Boolean(filters.from || filters.to || filters.status);

  return (
    <>
      <FilterBar
        errors={errors}
        filters={[
          {
            name: "from",
            label: t("fields.from"),
            type: "date",
            inAddress: true,
            defaultValue: range.from,
          },
          {
            name: "to",
            label: t("fields.to"),
            type: "date",
            inAddress: true,
            defaultValue: range.to,
          },
          {
            name: "status",
            label: t("fields.status"),
            type: "select",
            inAddress: true,
            options: [
              { value: "", label: t("filters.anyStatus") },
              ...APPOINTMENT_STATUSES.map((status) => ({
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
          caption={t("own.caption")}
          columns={columns}
          rows={result.data.data}
          getRowKey={(row) => String(row.id)}
          state={result.data.meta.total === 0 ? "empty" : "ready"}
          emptyState={
            narrowed ? (
              <EmptyState
                title={t("own.emptyFilteredTitle")}
                description={t("own.emptyFilteredDescription")}
              />
            ) : (
              <EmptyState
                title={t("own.emptyTodayTitle")}
                description={t("own.emptyTodayDescription")}
              />
            )
          }
          pagination={{
            page: result.data.meta.current_page,
            lastPage: result.data.meta.last_page,
            total: result.data.meta.total,
            hrefForPage: pageHref("/my/appointments", {
              from: filters.from,
              to: filters.to,
              status: filters.status,
            }),
          }}
        />
      ) : null}
    </>
  );
}
