"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormError } from "@/components/shared/form/form-error";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/features/auth/public";
import type { ApiError } from "@/lib/api/api-error";
import { useFormSubmit } from "@/lib/api/use-form-submit";
import { updatePatient } from "../api/patients";
import { recordToForm, toChangesSince } from "../form-values";
import { noteChange } from "../opening";
import type { PatientFormInput, PatientFormValues } from "../schemas/patient";
import type { Patient } from "../types";
import {
  PATIENT_FIELDS,
  PatientFields,
  usePatientFormSchema,
} from "./patient-fields";

/**
 * Starts from the record on screen, as a read only to change a phone number would write a second opening.
 * If `record` changes underneath, what was typed stays, and only what this person changed is sent (research R7).
 */
export function PatientEditForm({
  record,
  timeZone,
  onSaved,
  onCancel,
  onFailure,
}: {
  record: Patient;
  timeZone: string;
  onSaved: (saved: Patient) => void;
  onCancel: () => void;
  /** The form shows the failure. The reader decides whether the record can stay on screen. */
  onFailure: (error: ApiError) => void;
}) {
  const locale = useLocale();
  const [opened] = useState(record);
  const t = useTranslations("patients.form");
  const shared = useTranslations("shared.form");
  const hydrated = useHydrated();
  const schema = usePatientFormSchema(timeZone);
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<PatientFormInput, unknown, PatientFormValues>({
    resolver: zodResolver(schema),
    defaultValues: recordToForm(record),
  });
  const { working, formErrors, setFormErrors, submit } =
    useFormSubmit<PatientFormInput>({
      fields: PATIENT_FIELDS,
      setError,
      generalFailure: shared("generalFailure"),
    });

  // The button that opened this form has gone, so focus would otherwise fall to the page's start.
  useEffect(() => {
    setFocus("full_name");
  }, [setFocus]);

  function onSubmit(values: PatientFormValues) {
    const changes = toChangesSince(values, opened, record);
    // The API records a `PATCH` that changes nothing as an opening (research R6).
    if (Object.keys(changes).length === 0) {
      setFormErrors([shared("nothingToSave")]);
      return;
    }

    return submit(
      async () => {
        const result = await updatePatient(record.id, changes, locale);
        if (!result.ok) onFailure(result.error);
        return result;
      },
      (saved) => {
        // Held search results may show the old values (FR-020).
        noteChange();
        toast.success(t("saved"));
        onSaved(saved);
      },
    );
  }

  return (
    <form
      // POST, so that even a browser-handled submit can't put a patient's details in the address.
      method="post"
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="flex max-w-2xl flex-col gap-6"
    >
      <FormError messages={formErrors} />
      {/* What's sent is what was there on pressing save, so nothing can be typed after that. */}
      <fieldset disabled={working} className="contents">
        <PatientFields register={register} errors={errors} />
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!hydrated || working}>
          {working ? t("saving") : t("save")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={working}
          onClick={onCancel}
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
