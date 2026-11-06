import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { ClinicDate } from "@/components/shared/values/clinic-date";
import { Instant } from "@/components/shared/values/instant";
import { LtrText } from "@/components/shared/values/ltr-text";
import { UserText } from "@/components/shared/values/user-text";
import type { Patient } from "../types";

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="[overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

export function PatientDetails({
  record,
  timeZone,
}: {
  record: Patient;
  timeZone: string;
}) {
  const t = useTranslations("patients");
  const notRecorded = t("fields.notRecorded");
  const contact = record.emergency_contact;

  return (
    <dl className="grid max-w-2xl grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-4 gap-y-2">
      <Detail label={t("fields.number")}>
        <LtrText>{record.id}</LtrText>
      </Detail>
      <Detail label={t("fields.sex")}>{t(`sex.${record.sex}`)}</Detail>
      <Detail label={t("fields.dateOfBirth")}>
        <ClinicDate value={record.date_of_birth} />
      </Detail>
      <Detail label={t("fields.phone")}>
        <LtrText>{record.phone}</LtrText>
      </Detail>
      <Detail label={t("fields.nationalId")}>
        {record.national_id === null ? (
          notRecorded
        ) : (
          <LtrText>{record.national_id}</LtrText>
        )}
      </Detail>
      <Detail label={t("fields.address")}>
        {record.address === null ? (
          notRecorded
        ) : (
          <UserText>{record.address}</UserText>
        )}
      </Detail>
      {contact === null ? (
        <Detail label={t("fields.emergencyContact")}>{notRecorded}</Detail>
      ) : (
        <>
          <Detail label={t("fields.contactName")}>
            <UserText>{contact.name}</UserText>
          </Detail>
          <Detail label={t("fields.contactRelationship")}>
            <UserText>{contact.relationship}</UserText>
          </Detail>
          <Detail label={t("fields.contactPhone")}>
            <LtrText>{contact.phone}</LtrText>
          </Detail>
        </>
      )}
      <Detail label={t("fields.registeredAt")}>
        <Instant value={record.created_at} timeZone={timeZone} />
      </Detail>
      <Detail label={t("fields.updatedAt")}>
        <Instant value={record.updated_at} timeZone={timeZone} />
      </Detail>
    </dl>
  );
}
