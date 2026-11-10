import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ClinicDate } from "@/components/shared/values/clinic-date";
import { Instant } from "@/components/shared/values/instant";
import { LtrText } from "@/components/shared/values/ltr-text";
import { Money } from "@/components/shared/values/money";
import { UserText } from "@/components/shared/values/user-text";
import { PatientLink } from "@/features/patients/public";
import type { Charge, Payment, Refund } from "../types";

/** Takes focus after a change, because the control pressed may no longer exist. */
export const CHARGE_HEADING_ID = "charge-summary-heading";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

const DETAILS =
  "grid grid-cols-[minmax(auto,14rem)_1fr] gap-x-4 gap-y-2" as const;

/**
 * One charge, exactly as the API sent it: every amount is the API's own, and nothing here is worked out
 * (constitution V). Reasons appear only on this page. `actions` is what the person may do, decided by the caller.
 */
export function ChargeView({
  charge,
  timeZone,
  actions,
}: {
  charge: Charge;
  timeZone: string;
  /** What the person may do, with any notice about it, shown just above the payments. */
  actions?: ReactNode;
}) {
  const t = useTranslations("charges.details");
  const tMethod = useTranslations("shared.paymentMethod");

  const paymentColumns: DataTableColumn<Payment>[] = [
    {
      id: "amount",
      header: t("amount"),
      cell: (row) => <Money value={row.amount} />,
    },
    { id: "method", header: t("method"), cell: (row) => tMethod(row.method) },
    {
      id: "at",
      header: t("receivedAt"),
      cell: (row) => <Instant value={row.received_at} timeZone={timeZone} />,
    },
    {
      id: "by",
      header: t("receivedBy"),
      cell: (row) => <UserText>{row.received_by.name}</UserText>,
    },
  ];
  const refundColumns: DataTableColumn<Refund>[] = [
    {
      id: "amount",
      header: t("amount"),
      cell: (row) => <Money value={row.amount} />,
    },
    { id: "method", header: t("method"), cell: (row) => tMethod(row.method) },
    {
      id: "reason",
      header: t("reason"),
      cell: (row) => <UserText>{row.reason}</UserText>,
    },
    {
      id: "at",
      header: t("refundedAt"),
      cell: (row) => <Instant value={row.refunded_at} timeZone={timeZone} />,
    },
    {
      id: "by",
      header: t("refundedBy"),
      cell: (row) => <UserText>{row.refunded_by.name}</UserText>,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2
          id={CHARGE_HEADING_ID}
          tabIndex={-1}
          className="text-xl font-semibold outline-none"
        >
          {t("summaryHeading")}
        </h2>
        <dl className={DETAILS}>
          <Row label={t("status")}>
            <StatusBadge kind="charge" value={charge.status} />
          </Row>
          <Row label={t("date")}>
            <ClinicDate value={charge.date} />
          </Row>
          <Row label={t("doctor")}>
            <UserText>{charge.doctor.name}</UserText>
            {" · "}
            <UserText>{charge.doctor.title}</UserText>
          </Row>
          <Row label={t("patient")}>
            <PatientLink id={charge.patient.id}>
              <UserText>{charge.patient.full_name}</UserText>
            </PatientLink>
          </Row>
          <Row label={t("patientNumber")}>
            <LtrText>{charge.patient.id}</LtrText>
          </Row>
          <Row label={t("phone")}>
            <LtrText>{charge.patient.phone}</LtrText>
          </Row>
          <Row label={t("chargedBy")}>
            <UserText>{charge.charged_by.name}</UserText>
          </Row>
          <Row label={t("chargedAt")}>
            <Instant value={charge.charged_at} timeZone={timeZone} />
          </Row>
        </dl>
      </section>

      {charge.status === "cancelled" ? (
        <section
          role="note"
          aria-labelledby="charge-cancelled-heading"
          className="flex flex-col gap-2 rounded-lg border p-4"
        >
          <h2 id="charge-cancelled-heading" className="text-lg font-semibold">
            {t("cancelledTitle")}
          </h2>
          <p>{t("cancelledDescription")}</p>
          <dl className={DETAILS}>
            <Row label={t("cancelReason")}>
              <UserText>{charge.cancel_reason ?? ""}</UserText>
            </Row>
            <Row label={t("cancelledBy")}>
              <UserText>{charge.cancelled_by?.name ?? ""}</UserText>
            </Row>
            <Row label={t("cancelledAt")}>
              <Instant value={charge.cancelled_at} timeZone={timeZone} />
            </Row>
          </dl>
          {charge.visit_id === null ? <p>{t("visitGone")}</p> : null}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{t("amountsHeading")}</h2>
        <dl className={DETAILS}>
          <Row label={t("fee")}>
            <Money value={charge.fee} />
          </Row>
          <Row label={t("discount")}>
            <Money value={charge.discount} />
          </Row>
          {charge.discounted_by ? (
            <>
              <Row label={t("discountReason")}>
                <UserText>{charge.discount_reason ?? ""}</UserText>
              </Row>
              <Row label={t("discountedBy")}>
                <UserText>{charge.discounted_by.name}</UserText>
              </Row>
              <Row label={t("discountedAt")}>
                <Instant value={charge.discounted_at} timeZone={timeZone} />
              </Row>
            </>
          ) : null}
          <Row label={t("amountDue")}>
            <Money value={charge.amount_due} />
          </Row>
          <Row label={t("amountPaid")}>
            <Money value={charge.amount_paid} />
          </Row>
          <Row label={t("balance")}>
            <strong>
              <Money value={charge.balance} />
            </strong>
          </Row>
        </dl>
      </section>

      {actions}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{t("paymentsHeading")}</h2>
        {charge.payments.length === 0 ? (
          <p className="text-muted-foreground">{t("noPayments")}</p>
        ) : (
          <DataTable
            caption={t("paymentsCaption")}
            columns={paymentColumns}
            rows={charge.payments}
            getRowKey={(row) => String(row.id)}
            state="ready"
          />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{t("refundsHeading")}</h2>
        {charge.refunds.length === 0 ? (
          <p className="text-muted-foreground">{t("noRefunds")}</p>
        ) : (
          <DataTable
            caption={t("refundsCaption")}
            columns={refundColumns}
            rows={charge.refunds}
            getRowKey={(row) => String(row.id)}
            state="ready"
          />
        )}
      </section>
    </div>
  );
}
