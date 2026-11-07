"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { DataTableColumn } from "@/components/shared/data-table";
import type { FilterDefinition } from "@/components/shared/filter-bar";
import { ClinicDate } from "@/components/shared/values/clinic-date";
import { LtrText } from "@/components/shared/values/ltr-text";
import { UserText } from "@/components/shared/values/user-text";
import type { PatientSummary } from "../types";
import { PatientLink } from "./patient-link";

/**
 * The five fields a list may show. Everything else is on the record, and opening that is audited (FR-005).
 * By default the name links to the record, and a chooser, which must not, gives its own.
 */
export function usePatientColumns(
  nameCell: (patient: PatientSummary) => ReactNode = (patient) => (
    <PatientLink id={patient.id}>
      <UserText>{patient.full_name}</UserText>
    </PatientLink>
  ),
): DataTableColumn<PatientSummary>[] {
  const t = useTranslations("patients");

  return [
    {
      id: "number",
      header: t("fields.number"),
      cell: (patient) => <LtrText>{patient.id}</LtrText>,
    },
    { id: "name", header: t("fields.fullName"), cell: nameCell },
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

/** The four search fields. All are private: none goes in the page's address (constitution II). */
export function usePatientFilters(): FilterDefinition[] {
  const t = useTranslations("patients");

  return [
    {
      type: "text",
      name: "name",
      label: t("fields.fullName"),
      hint: t("search.nameHint"),
      inAddress: false,
    },
    {
      type: "text",
      name: "phone",
      label: t("fields.phone"),
      hint: t("search.wholeValueHint"),
      inAddress: false,
    },
    {
      type: "text",
      name: "id",
      label: t("fields.number"),
      hint: t("search.wholeValueHint"),
      inAddress: false,
    },
    {
      type: "text",
      name: "national_id",
      label: t("fields.nationalId"),
      hint: t("search.wholeValueHint"),
      inAddress: false,
    },
  ];
}
