"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { FormField } from "@/components/shared/form/form-field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { clinicToday } from "@/lib/format/clinic-today";
import {
  type PatientFormInput,
  patientFormSchema,
  SEXES,
} from "../schemas/patient";

/** The API's keys that have a field on screen. Any other goes to form level, rather than being lost. */
export const PATIENT_FIELDS = [
  "full_name",
  "date_of_birth",
  "sex",
  "phone",
  "national_id",
  "address",
  "emergency_contact.name",
  "emergency_contact.relationship",
  "emergency_contact.phone",
] as const;

export const EMPTY_PATIENT_FORM = {
  full_name: "",
  date_of_birth: "",
  phone: "",
  national_id: "",
  address: "",
  emergency_contact: { name: "", relationship: "", phone: "" },
};

export function usePatientFormSchema(timeZone: string) {
  const t = useTranslations("patients.form");

  return useMemo(
    () =>
      patientFormSchema(
        {
          nameRequired: t("nameRequired"),
          nameTooLong: t("nameTooLong"),
          dateRequired: t("dateRequired"),
          dateRange: t("dateRange"),
          sexRequired: t("sexRequired"),
          phoneRule: t("phoneRule"),
          nationalIdRule: t("nationalIdRule"),
          addressTooLong: t("addressTooLong"),
          contactPartRequired: t("contactPartRequired"),
          contactNameTooLong: t("contactNameTooLong"),
          relationshipTooLong: t("relationshipTooLong"),
        },
        () => clinicToday(timeZone),
      ),
    [t, timeZone],
  );
}

const heading = "text-xl font-semibold";

/** The fields shared by registering and editing. Autofill is off on all, so that one patient's details can't be offered for another (FR-029). */
export function PatientFields({
  register,
  errors,
}: {
  register: UseFormRegister<PatientFormInput>;
  errors: FieldErrors<PatientFormInput>;
}) {
  const t = useTranslations("patients");
  const contact = errors.emergency_contact;

  return (
    <>
      <section className="flex flex-col gap-4">
        <h2 className={heading}>{t("form.requiredHeading")}</h2>
        <FormField
          label={t("fields.fullName")}
          error={errors.full_name?.message}
          required
        >
          {(input) => (
            <Input
              {...input}
              {...register("full_name")}
              dir="auto"
              autoComplete="off"
            />
          )}
        </FormField>
        <FormField
          label={t("fields.dateOfBirth")}
          error={errors.date_of_birth?.message}
          required
        >
          {(input) => (
            <Input
              {...input}
              {...register("date_of_birth")}
              type="date"
              autoComplete="off"
            />
          )}
        </FormField>
        <FormField label={t("fields.sex")} error={errors.sex?.message} required>
          {(input) => (
            <NativeSelect
              {...input}
              {...register("sex")}
              autoComplete="off"
              className="w-full"
            >
              <NativeSelectOption value="">
                {t("form.chooseSex")}
              </NativeSelectOption>
              {SEXES.map((sex) => (
                <NativeSelectOption key={sex} value={sex}>
                  {t(`sex.${sex}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField
          label={t("fields.phone")}
          hint={t("form.phoneHint")}
          error={errors.phone?.message}
          required
        >
          {(input) => (
            <Input
              {...input}
              {...register("phone")}
              type="tel"
              dir="ltr"
              autoComplete="off"
            />
          )}
        </FormField>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className={heading}>{t("form.optionalHeading")}</h2>
        <FormField
          label={t("fields.nationalId")}
          hint={t("form.nationalIdHint")}
          error={errors.national_id?.message}
        >
          {(input) => (
            <Input
              {...input}
              {...register("national_id")}
              inputMode="numeric"
              dir="ltr"
              autoComplete="off"
            />
          )}
        </FormField>
        <FormField label={t("fields.address")} error={errors.address?.message}>
          {(input) => (
            <Textarea
              {...input}
              {...register("address")}
              dir="auto"
              autoComplete="off"
            />
          )}
        </FormField>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className={heading}>{t("form.contactHeading")}</h2>
          <p className="text-[0.8125rem] text-muted-foreground">
            {t("form.contactHint")}
          </p>
        </div>
        <FormField
          label={t("fields.contactName")}
          error={contact?.name?.message}
        >
          {(input) => (
            <Input
              {...input}
              {...register("emergency_contact.name")}
              dir="auto"
              autoComplete="off"
            />
          )}
        </FormField>
        <FormField
          label={t("fields.contactRelationship")}
          error={contact?.relationship?.message}
        >
          {(input) => (
            <Input
              {...input}
              {...register("emergency_contact.relationship")}
              dir="auto"
              autoComplete="off"
            />
          )}
        </FormField>
        <FormField
          label={t("fields.contactPhone")}
          error={contact?.phone?.message}
        >
          {(input) => (
            <Input
              {...input}
              {...register("emergency_contact.phone")}
              type="tel"
              dir="ltr"
              autoComplete="off"
            />
          )}
        </FormField>
      </section>
    </>
  );
}
