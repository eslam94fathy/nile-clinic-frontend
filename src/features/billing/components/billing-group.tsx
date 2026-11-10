"use client";

import { useTranslations } from "next-intl";
import {
  DataTable,
  type DataTableColumn,
  type DataTablePagination,
} from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { LtrText } from "@/components/shared/values/ltr-text";
import { Money } from "@/components/shared/values/money";
import { NoValue } from "@/components/shared/values/no-value";
import { UserText } from "@/components/shared/values/user-text";
import { Button } from "@/components/ui/button";
import { PatientLink } from "@/features/patients/public";
import type { DoctorGroup } from "@/lib/group-by-doctor";
import { Link } from "@/lib/i18n/navigation";
import type { VisitCharge } from "../types";

/** Found again after a refresh, which may have replaced the button or removed it. */
export const chargeMarker = (visitId: number) => `charge-${visitId}`;

/**
 * One doctor's visits, in the API's order. A visit with no active charge offers "Charge visit"; one with a charge
 * links to it. Nothing here is prefetched, and a patient's record opens only through `PatientLink`.
 */
export function BillingGroup({
  group,
  charging,
  onCharge,
  pagination,
}: {
  group: DoctorGroup<VisitCharge>;
  /** The visit being charged, whose button says so. Every other row's waits, as one charge is sent at a time. */
  charging: number | null;
  onCharge: (visit: VisitCharge) => void;
  /** On the last group only, as the API's pages aren't per doctor. */
  pagination?: DataTablePagination | undefined;
}) {
  const t = useTranslations("billing");

  const columns: DataTableColumn<VisitCharge>[] = [
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
      id: "visit",
      header: t("fields.visit"),
      cell: (row) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge kind="queue" value={row.status} />
          {row.walk_in ? (
            <span className="text-[0.8125rem] text-muted-foreground">
              {t("walkIn")}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "charge",
      header: t("fields.chargeStatus"),
      cell: (row) => <StatusBadge kind="charge" value={row.charge_status} />,
    },
    {
      id: "balance",
      header: t("fields.balance"),
      cell: (row) =>
        row.balance === null ? <NoValue /> : <Money value={row.balance} />,
    },
    {
      id: "actions",
      header: t("fields.actions"),
      cell: (row) =>
        row.charge_id === null ? (
          <Button
            type="button"
            size="sm"
            data-charge-action={chargeMarker(row.id)}
            disabled={charging !== null}
            onClick={() => onCharge(row)}
          >
            {charging === row.id ? t("charge.working") : t("charge.action")}
          </Button>
        ) : (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/charges/${row.charge_id}`} prefetch={false}>
              {t("viewCharge")}
            </Link>
          </Button>
        ),
    },
  ];

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-base font-semibold">
        <UserText>{group.doctor.name}</UserText>
        <span className="font-normal text-muted-foreground">
          {" · "}
          <UserText>{group.doctor.title}</UserText>
        </span>
      </h3>
      <DataTable
        caption={t("caption", { doctor: group.doctor.name })}
        columns={columns}
        rows={group.rows}
        getRowKey={(row) => String(row.id)}
        state="ready"
        pagination={pagination}
      />
    </section>
  );
}
