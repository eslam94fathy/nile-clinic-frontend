import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/shared/status-badge";
import { ClinicDate } from "@/components/shared/values/clinic-date";
import { Instant } from "@/components/shared/values/instant";
import { LtrText } from "@/components/shared/values/ltr-text";
import { UserText } from "@/components/shared/values/user-text";
import { PatientLink } from "@/features/patients/public";
import type { Appointment } from "../types";
import { OutsideLabel } from "./outside-label";
import { TimeRange } from "@/components/shared/values/time-range";

/** The heading that takes focus after a change, because the control pressed may no longer exist. */
export const DETAILS_HEADING_ID = "appointment-details-heading";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

export function AppointmentDetails({
  appointment,
  timeZone,
}: {
  appointment: Appointment;
  timeZone: string;
}) {
  const t = useTranslations("appointments");
  const details = useTranslations("appointments.details");

  return (
    <section className="flex flex-col gap-3">
      <h2
        id={DETAILS_HEADING_ID}
        tabIndex={-1}
        className="text-xl font-semibold outline-none"
      >
        {details("heading")}
      </h2>
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
        <Row label={t("fields.doctor")}>
          <UserText>{appointment.doctor.name}</UserText>
          {" · "}
          <UserText>{appointment.doctor.title}</UserText>
        </Row>
        <Row label={t("fields.patient")}>
          <PatientLink id={appointment.patient.id}>
            <UserText>{appointment.patient.full_name}</UserText>
          </PatientLink>
        </Row>
        <Row label={t("fields.patientNumber")}>
          <LtrText>{appointment.patient.id}</LtrText>
        </Row>
        <Row label={t("fields.phone")}>
          <LtrText>{appointment.patient.phone}</LtrText>
        </Row>
        <Row label={t("fields.note")}>
          {appointment.note === null ? (
            details("notRecorded")
          ) : (
            <UserText>{appointment.note}</UserText>
          )}
        </Row>
        <Row label={details("bookedBy")}>
          {appointment.booked_by ? (
            <UserText>{appointment.booked_by.name}</UserText>
          ) : (
            details("notRecorded")
          )}
        </Row>
        <Row label={details("bookedAt")}>
          <Instant value={appointment.booked_at} timeZone={timeZone} />
        </Row>
        {appointment.rescheduled_at === null ? null : (
          <>
            <Row label={details("rescheduledBy")}>
              {appointment.rescheduled_by ? (
                <UserText>{appointment.rescheduled_by.name}</UserText>
              ) : (
                details("notRecorded")
              )}
            </Row>
            <Row label={details("rescheduledAt")}>
              <Instant value={appointment.rescheduled_at} timeZone={timeZone} />
            </Row>
          </>
        )}
        {appointment.status_changed_at === null ? null : (
          <>
            <Row label={details("statusChangedBy")}>
              {appointment.status_changed_by ? (
                <UserText>{appointment.status_changed_by.name}</UserText>
              ) : (
                details("notRecorded")
              )}
            </Row>
            <Row label={details("statusChangedAt")}>
              <Instant
                value={appointment.status_changed_at}
                timeZone={timeZone}
              />
            </Row>
          </>
        )}
        {appointment.cancellation_reason === null ? null : (
          <Row label={details("cancellationReason")}>
            <UserText>{appointment.cancellation_reason}</UserText>
          </Row>
        )}
      </dl>
    </section>
  );
}
