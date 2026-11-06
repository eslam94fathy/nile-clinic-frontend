import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/shared/status-badge";
import { ClinicDate } from "@/components/shared/values/clinic-date";
import { Instant } from "@/components/shared/values/instant";
import { LtrText } from "@/components/shared/values/ltr-text";
import { UserText } from "@/components/shared/values/user-text";
import type { OwnAppointment } from "../types";
import { OutsideLabel } from "./outside-label";
import { TimeRange } from "./time-range";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/** Read-only, with no link to a patient record: doctors have no access to it here (FR-017 of the backend). */
export function OwnAppointmentDetails({
  appointment,
  timeZone,
}: {
  appointment: OwnAppointment;
  timeZone: string;
}) {
  const t = useTranslations("appointments");
  const details = useTranslations("appointments.details");

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">{details("heading")}</h2>
      {appointment.outside_availability ? (
        <p className="text-muted-foreground">{t("own.outsideDescription")}</p>
      ) : null}
      <dl className="grid grid-cols-[minmax(auto,14rem)_1fr] gap-x-4 gap-y-2">
        <Row label={t("fields.date")}>
          <ClinicDate value={appointment.date} />
        </Row>
        <Row label={t("fields.time")}>
          <TimeRange start={appointment.start} end={appointment.end} />
        </Row>
        <Row label={t("fields.status")}>
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge kind="appointment" value={appointment.status} />
            {appointment.outside_availability ? <OutsideLabel /> : null}
          </span>
        </Row>
        <Row label={t("fields.patient")}>
          <UserText>{appointment.patient.full_name}</UserText>
        </Row>
        <Row label={t("fields.patientNumber")}>
          <LtrText>{appointment.patient.id}</LtrText>
        </Row>
        <Row label={t("fields.sex")}>{t(`sex.${appointment.patient.sex}`)}</Row>
        <Row label={t("fields.dateOfBirth")}>
          <ClinicDate value={appointment.patient.date_of_birth} />
        </Row>
        <Row label={t("fields.note")}>
          {appointment.note === null ? (
            details("notRecorded")
          ) : (
            <UserText>{appointment.note}</UserText>
          )}
        </Row>
        <Row label={details("bookedAt")}>
          <Instant value={appointment.booked_at} timeZone={timeZone} />
        </Row>
      </dl>
    </section>
  );
}
