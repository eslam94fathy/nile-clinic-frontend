"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { FormError } from "@/components/shared/form/form-error";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/features/auth/public";
import type { ApiResult } from "@/lib/api/api-error";
import { useFormSubmit } from "@/lib/api/use-form-submit";
import { useRouter } from "@/lib/i18n/navigation";
import {
  findByPhone,
  type PatientPage,
  registerPatient,
} from "../api/patients";
import { toRegisterBody } from "../form-values";
import { changeCount, handOver, noteChange } from "../opening";
import {
  normalizePhone,
  type PatientFormInput,
  type PatientFormValues,
} from "../schemas/patient";
import {
  EMPTY_PATIENT_FORM,
  PATIENT_FIELDS,
  PatientFields,
  usePatientFormSchema,
} from "./patient-fields";
import { type DuplicateWarning, PossibleMatches } from "./possible-matches";

/** `null` means the check couldn't run. Only `401` and `403` take their usual routes (contract). */
async function checkPhone(
  phone: string,
  locale: string,
): Promise<ApiResult<PatientPage | null>> {
  const result = await findByPhone(phone, locale);
  if (result.ok) return result;

  return result.error.status === 401 || result.error.status === 403
    ? result
    : { ok: true, status: result.error.status, data: null };
}

export function RegisterPatient({ timeZone }: { timeZone: string }) {
  const locale = useLocale();
  const t = useTranslations("patients.registerForm");
  const shared = useTranslations("shared.form");
  const hydrated = useHydrated();
  const router = useRouter();
  const schema = usePatientFormSchema(timeZone);
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<PatientFormInput, unknown, PatientFormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_PATIENT_FORM,
  });
  const { working, formErrors, submit } = useFormSubmit<PatientFormInput>({
    fields: PATIENT_FIELDS,
    setError,
    generalFailure: shared("generalFailure"),
  });
  const [step, setStep] = useState<"checking" | "saving">("checking");
  const [warning, setWarning] = useState<DuplicateWarning | null>(null);
  const changesSeen = useRef(changeCount());

  // Someone may open a match, correct it, and come back. A decision to register anyway needs what's true now.
  // This is a list, so it isn't audited. A failure leaves the panel, and the next submit checks again.
  useEffect(() => {
    const changes = changeCount();
    if (changes === changesSeen.current) return;
    changesSeen.current = changes;
    if (!warning) return;

    const { phone } = warning;
    void findByPhone(phone, locale).then((result) => {
      if (!result.ok) return;
      setWarning((current) => {
        if (current?.phone !== phone) return current;
        return result.data.meta.total > 0
          ? { kind: "matches", phone, page: result.data }
          : null;
      });
    });
  }, [warning, locale]);

  // A warning holds only for the phone it's about, however that phone is written (research R8).
  const typedPhone = useWatch({ control, name: "phone" });
  const shownWarning =
    warning?.phone === normalizePhone(typedPhone ?? "") ? warning : null;

  function save(values: PatientFormValues) {
    setStep("saving");
    return submit(
      () => registerPatient(toRegisterBody(values), locale),
      (record) => {
        // The record goes to the reader, because reading it would write an opening nobody asked for (FR-011).
        handOver(record);
        noteChange();
        // This page stays mounted but hidden after moving on, so a patient's details must not stay in it.
        reset();
        setWarning(null);
        toast.success(t("registered", { number: String(record.id) }));
        // A submitted form isn't somewhere to go back to.
        router.replace(`/patients/${record.id}`);
      },
    );
  }

  function check(values: PatientFormValues) {
    setStep("checking");
    setWarning(null);
    return submit(
      () => checkPhone(values.phone, locale),
      (page) => {
        if (page === null) {
          setWarning({ kind: "failed", phone: values.phone });
        } else if (page.meta.total > 0) {
          setWarning({ kind: "matches", phone: values.phone, page });
        } else {
          void save(values);
        }
      },
    );
  }

  return (
    <form
      // POST, so that even a browser-handled submit can't put a patient's details in the address.
      method="post"
      noValidate
      onSubmit={handleSubmit(check)}
      className="flex max-w-2xl flex-col gap-6"
    >
      <FormError messages={formErrors} />
      {/* What's saved is what was checked, so nothing can be typed in between. */}
      <fieldset disabled={working} className="contents">
        <PatientFields register={register} errors={errors} />
      </fieldset>
      {shownWarning ? (
        <PossibleMatches
          warning={shownWarning}
          disabled={!hydrated || working}
          onRegisterAnyway={() => void handleSubmit(save)()}
          onTryAgain={() => void handleSubmit(check)()}
        />
      ) : null}
      <div>
        <Button type="submit" disabled={!hydrated || working}>
          {working
            ? step === "checking"
              ? t("checking")
              : t("submitting")
            : t("submit")}
        </Button>
      </div>
    </form>
  );
}
