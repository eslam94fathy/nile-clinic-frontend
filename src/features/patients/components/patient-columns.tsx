"use client";

import { useTranslations } from "next-intl";
import type { DataTableColumn } from "@/components/shared/data-table";
import { ClinicDate } from "@/components/shared/values/clinic-date";
import { LtrText } from "@/components/shared/values/ltr-text";
import { UserText } from "@/components/shared/values/user-text";
import type { PatientSummary } from "../types";
import { PatientLink } from "./patient-link";

/** The five fields a list may show. Everything else is on the record, and opening that is audited (FR-005). */
export function usePatientColumns(): DataTableColumn<PatientSummary>[] {
  const t = useTranslations("patients");

  return [
    {
      id: "number",
      header: t("fields.number"),
      cell: (patient) => <LtrText>{patient.id}</LtrText>,
    },
    {
      id: "name",
      header: t("fields.fullName"),
      cell: (patient) => (
        <PatientLink id={patient.id}>
          <UserText>{patient.full_name}</UserText>
        </PatientLink>
      ),
    },
    {
      id: "sex",
      header: t("fields.sex"),
      cell: (patient) => t(`sex.${patient.sex}`),
    },
    {
      id: "dateOfBirth",
      header: t("fields.dateOfBirth"),
      cell: (patient) => <ClinicDate value={patient.date_of_birth} />,
    },
    {
      id: "phone",
      header: t("fields.phone"),
      cell: (patient) => <LtrText>{patient.phone}</LtrText>,
    },
  ];
}
