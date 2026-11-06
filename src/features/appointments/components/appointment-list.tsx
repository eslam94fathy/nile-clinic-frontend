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
import { Button } from "@/components/ui/button";
import { ApiFailureState } from "@/features/auth/public";
import type { ApiResult } from "@/lib/api/api-error";
import { type PageMeta, pageHref } from "@/lib/api/pagination";
import { Link } from "@/lib/i18n/navigation";
import {
  APPOINTMENT_STATUSES,
  type AppointmentFilters,
  type AppointmentSummary,
} from "../types";
import { OutsideLabel } from "./outside-label";
import { TimeRange } from "./time-range";

const FILTER_FIELDS = new Set(["from", "to", "doctor_id", "status"]);

export type DoctorOption = {
  id: number;
  name: string;
  title: string;
  is_active: boolean;
};

export function AppointmentList({
  result,
  filters,
  range,
  doctors,
}: {
  result: ApiResult<{ data: AppointmentSummary[]; meta: PageMeta }>;
  filters: AppointmentFilters;
  /** The dates being read, which the filter shows even when the address has none. */
  range: { from: string; to: string };
  doctors: DoctorOption[];
}) {
  const t = useTranslations("appointments");
  const tStatus = useTranslations("shared.status.appointment");
  const tShared = useTranslations("shared.form");

  // A refusal keeps the filters, so the person can correct them. Anything else replaces the list.
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

  const columns: DataTableColumn<AppointmentSummary>[] = [
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
          href={`/appointments/${row.id}`}
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
            <LtrText>{row.patient.phone}</LtrText>
          </span>
        </div>
      ),
    },
    {
      id: "doctor",
      header: t("fields.doctor"),
      cell: (row) => (
        <div className="flex flex-col">
          <UserText>{row.doctor.name}</UserText>
          <span className="text-[0.8125rem] text-muted-foreground">
            <UserText>{row.doctor.title}</UserText>
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

  const narrowed = Boolean(
    filters.from ||
    filters.to ||
    filters.doctor_id ||
    filters.patient_id ||
    filters.status,
  );
  const bookLink = (
    <Button variant="outline" asChild>
      <Link
        href={
          filters.patient_id
            ? `/appointments/new?patient_id=${filters.patient_id}`
            : "/appointments/new"
        }
        prefetch={false}
      >
        {t("book")}
      </Link>
    </Button>
  );
  const emptyState = filters.outside_availability ? (
    <EmptyState
      title={t("empty.moveTitle")}
      description={t("empty.moveDescription")}
    />
  ) : narrowed ? (
    <EmptyState
      title={t("empty.filteredTitle")}
      description={t("empty.filteredDescription")}
      action={bookLink}
    />
  ) : (
    <EmptyState
      title={t("empty.todayTitle")}
      description={t("empty.todayDescription")}
      action={bookLink}
    />
  );

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
            name: "doctor_id",
            label: t("fields.doctor"),
            type: "select",
            inAddress: true,
            options: [
              { value: "", label: t("filters.anyDoctor") },
              ...doctors.map((doctor) => ({
                value: String(doctor.id),
                label: doctor.is_active
                  ? doctor.name
                  : t("filters.inactiveDoctor", { name: doctor.name }),
              })),
            ],
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
          caption={t("caption")}
          columns={columns}
          rows={result.data.data}
          getRowKey={(row) => String(row.id)}
          // By the total, as a page past the end has no rows, and needs its links back.
          state={result.data.meta.total === 0 ? "empty" : "ready"}
          emptyState={emptyState}
          pagination={{
            page: result.data.meta.current_page,
            lastPage: result.data.meta.last_page,
            total: result.data.meta.total,
            hrefForPage: pageHref("/appointments", {
              from: filters.from,
              to: filters.to,
              doctor_id: filters.doctor_id,
              patient_id: filters.patient_id,
              status: filters.status,
              outside_availability: filters.outside_availability,
            }),
          }}
        />
      ) : null}
    </>
  );
}
