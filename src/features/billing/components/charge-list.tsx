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
import { Money } from "@/components/shared/values/money";
import { UserText } from "@/components/shared/values/user-text";
import { Button } from "@/components/ui/button";
import { ApiFailureState } from "@/features/auth/public";
import { PatientLink } from "@/features/patients/public";
import type { ApiResult } from "@/lib/api/api-error";
import { type PageMeta, pageHref } from "@/lib/api/pagination";
import { Link } from "@/lib/i18n/navigation";
import {
  CHARGE_STATUSES,
  type ChargeFilters,
  type ChargeSummary,
} from "../types";

const FILTER_FIELDS = new Set(["from", "to", "doctor_id", "status"]);

type DoctorOption = { id: number; name: string; is_active: boolean };

/**
 * Charges over a range, newest first, as the API orders them. A range the API would refuse isn't read at all, and
 * says so on the range (research R9). No reason appears here; they're on each charge's page only.
 */
export function ChargeList({
  result,
  filters,
  doctors,
}: {
  /** `null` when the range or the patient was refused here, so nothing was read. */
  result: ApiResult<{ data: ChargeSummary[]; meta: PageMeta }> | null;
  filters: ChargeFilters;
  /** `null` when they couldn't be read: the charges still show, with less to filter by. */
  doctors: DoctorOption[] | null;
}) {
  const t = useTranslations("charges");
  const tStatus = useTranslations("shared.status.charge");
  const tShared = useTranslations("shared.form");

  // A refusal keeps the filters, so the person can correct them. Anything else replaces the list.
  if (result && !result.ok && result.error.status !== 422) {
    return <ApiFailureState error={result.error} />;
  }

  const fieldErrors = result && !result.ok ? result.error.fieldErrors : {};
  const errors: Record<string, string> = Object.fromEntries(
    Object.entries(fieldErrors)
      .filter(([key]) => FILTER_FIELDS.has(key))
      .map(([key, messages]) => [key, messages.join(" ")]),
  );
  if (filters.rangeProblem) {
    errors.to = t(
      filters.rangeProblem === "too_long" ? "range.tooLong" : "range.reversed",
    );
  }
  const others = Object.entries(fieldErrors)
    .filter(([key]) => !FILTER_FIELDS.has(key))
    .flatMap(([, messages]) => messages);
  const refusals =
    !result || result.ok
      ? []
      : others.length > 0 || Object.keys(errors).length > 0
        ? others
        : [result.error.message ?? tShared("generalFailure")];

  const columns: DataTableColumn<ChargeSummary>[] = [
    {
      id: "date",
      header: t("fields.date"),
      cell: (row) => (
        <Link
          href={`/charges/${row.id}`}
          prefetch={false}
          className="font-medium underline underline-offset-4"
        >
          <ClinicDate value={row.date} />
        </Link>
      ),
    },
    {
      id: "status",
      header: t("fields.status"),
      cell: (row) => <StatusBadge kind="charge" value={row.status} />,
    },
    {
      id: "patient",
      header: t("fields.patient"),
      cell: (row) => (
        <div className="flex flex-col">
          <PatientLink id={row.patient.id}>
            <UserText>{row.patient.full_name}</UserText>
          </PatientLink>
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
      cell: (row) => <UserText>{row.doctor.name}</UserText>,
    },
    {
      id: "fee",
      header: t("fields.fee"),
      cell: (row) => <Money value={row.fee} />,
    },
    {
      id: "discount",
      header: t("fields.discount"),
      cell: (row) => <Money value={row.discount} />,
    },
    {
      id: "due",
      header: t("fields.amountDue"),
      cell: (row) => <Money value={row.amount_due} />,
    },
    {
      id: "paid",
      header: t("fields.amountPaid"),
      cell: (row) => <Money value={row.amount_paid} />,
    },
    {
      id: "balance",
      header: t("fields.balance"),
      cell: (row) => <Money value={row.balance} />,
    },
    {
      id: "open",
      header: t("open"),
      cell: (row) => (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/charges/${row.id}`} prefetch={false}>
            {t("open")}
          </Link>
        </Button>
      ),
    },
  ];

  const narrowed = Boolean(
    filters.patientId || filters.doctorId || filters.status,
  );
  const address = {
    from: filters.from,
    to: filters.to,
    patient_id: filters.patientId ? String(filters.patientId) : undefined,
    doctor_id: filters.doctorId ? String(filters.doctorId) : undefined,
    status: filters.status ?? undefined,
  };

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
            defaultValue: filters.from,
          },
          {
            name: "to",
            label: t("fields.to"),
            type: "date",
            inAddress: true,
            defaultValue: filters.to,
          },
          {
            name: "doctor_id",
            label: t("fields.doctor"),
            type: "select",
            inAddress: true,
            ...(doctors ? {} : { hint: t("filters.doctorsUnavailable") }),
            options: [
              { value: "", label: t("filters.anyDoctor") },
              ...(doctors
                ? doctors.map((doctor) => ({
                    value: String(doctor.id),
                    label: doctor.is_active
                      ? doctor.name
                      : t("filters.inactiveDoctor", { name: doctor.name }),
                  }))
                : // Without this, a list narrowed to one doctor would look like everyone's.
                  filters.doctorId
                  ? [
                      {
                        value: String(filters.doctorId),
                        label: String(filters.doctorId),
                      },
                    ]
                  : []),
            ],
          },
          {
            name: "status",
            label: t("fields.status"),
            type: "select",
            inAddress: true,
            options: [
              { value: "", label: t("filters.anyStatus") },
              ...CHARGE_STATUSES.map((status) => ({
                value: status,
                label: tStatus(status),
              })),
            ],
          },
        ]}
      />
      <FormError messages={refusals} />
      {result?.ok ? (
        <DataTable
          caption={t("caption")}
          columns={columns}
          rows={result.data.data}
          getRowKey={(row) => String(row.id)}
          // By the total, as a page past the end has no rows, and needs its links back.
          state={result.data.meta.total === 0 ? "empty" : "ready"}
          emptyState={
            <EmptyState
              title={t(narrowed ? "empty.filteredTitle" : "empty.rangeTitle")}
              description={t(
                narrowed
                  ? "empty.filteredDescription"
                  : "empty.rangeDescription",
              )}
            />
          }
          pagination={{
            page: result.data.meta.current_page,
            lastPage: result.data.meta.last_page,
            total: result.data.meta.total,
            hrefForPage: pageHref("/charges", address),
          }}
        />
      ) : null}
    </>
  );
}
