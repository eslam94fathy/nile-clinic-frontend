"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { FormError } from "@/components/shared/form/form-error";
import { FormField } from "@/components/shared/form/form-field";
import { LtrText } from "@/components/shared/values/ltr-text";
import { UserText } from "@/components/shared/values/user-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/features/auth/public";
import type { ApiResult } from "@/lib/api/api-error";
import { useFormSubmit } from "@/lib/api/use-form-submit";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { createDoctor, updateDoctor } from "../api/doctors";
import {
  type DoctorFormValues,
  doctorFormSchema,
  toCreateBody,
  toUpdateBody,
} from "../schemas/doctor";
import type { Doctor, Specialty } from "../types";
import { SpecialtyChoices } from "./specialty-choices";

const FIELDS = [
  "user_id",
  "title",
  "registration_number",
  "specialty_ids",
] as const;

const createdSchema = z.object({ data: z.object({ id: z.number() }) });

/** The API can also answer `specialty_ids.0`. There's one place to show those, so they all go there. */
function gatherSpecialtyErrors(result: ApiResult<unknown>): ApiResult<unknown> {
  if (result.ok) return result;

  const fieldErrors: Record<string, string[]> = {};
  for (const [key, messages] of Object.entries(result.error.fieldErrors)) {
    const target = key.startsWith("specialty_ids.") ? "specialty_ids" : key;
    fieldErrors[target] = [...(fieldErrors[target] ?? []), ...messages];
  }
  return { ok: false, error: { ...result.error, fieldErrors } };
}

type Account = { id: number; name: string; email: string };

/** Creates a profile for the account given, or edits the doctor given. The linked account never changes. */
export function DoctorForm({
  account,
  doctor,
  specialties,
}: {
  account?: Account;
  doctor?: Doctor;
  specialties: Specialty[];
}) {
  const locale = useLocale();
  const t = useTranslations("doctors");
  const shared = useTranslations("shared.form");
  const hydrated = useHydrated();
  const router = useRouter();
  const schema = useMemo(
    () =>
      doctorFormSchema({
        titleRequired: t("titleRequired"),
        titleTooLong: t("titleTooLong"),
        specialtiesRequired: t("specialtiesRequired"),
      }),
    [t],
  );
  const {
    register,
    handleSubmit,
    setError,
    reset,
    control,
    formState: { errors },
  } = useForm<DoctorFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: doctor?.title ?? "",
      registration_number: doctor?.registration_number ?? "",
      specialty_ids: doctor?.specialties.map(({ id }) => id) ?? [],
    },
  });
  const { working, formErrors, setFormErrors, submit } =
    useFormSubmit<DoctorFormValues>({
      fields: FIELDS,
      setError,
      generalFailure: shared("generalFailure"),
    });

  function goToDoctor(id: number, notice: string) {
    toast.success(notice);
    router.push(`/doctors/${id}`);
    // Pages opened before this change are still mounted, and this is what updates them (ADR 0011).
    router.refresh();
  }

  async function onSubmit(values: DoctorFormValues) {
    if (doctor) {
      const body = toUpdateBody(doctor, values);
      if (Object.keys(body).length === 0) {
        setFormErrors([shared("nothingToSave")]);
        return;
      }
      await submit(
        async () =>
          gatherSpecialtyErrors(await updateDoctor(doctor.id, body, locale)),
        () => goToDoctor(doctor.id, t("saved")),
      );
      return;
    }

    if (!account) return;
    await submit(
      async () =>
        gatherSpecialtyErrors(
          await createDoctor(toCreateBody(account.id, values), locale),
        ),
      (data) => {
        // This page stays mounted but hidden after moving on, and must start clean if opened again.
        reset();
        const created = createdSchema.safeParse(data);
        if (created.success) {
          goToDoctor(created.data.data.id, t("created"));
          return;
        }
        toast.success(t("created"));
        router.push("/doctors");
        router.refresh();
      },
    );
  }

  return (
    <form
      method="post"
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="flex max-w-md flex-col gap-4"
    >
      <FormError messages={formErrors} />
      {account ? (
        <div className="flex flex-col items-start gap-1">
          <p className="text-sm font-medium">{t("account")}</p>
          <p>
            <UserText>{account.name}</UserText>
            {" · "}
            <LtrText breakable>{account.email}</LtrText>
          </p>
          {errors.user_id?.message ? (
            <p
              role="alert"
              className="text-[0.8125rem] font-medium text-destructive"
            >
              {errors.user_id.message}
            </p>
          ) : null}
          <Link
            href="/doctors/new"
            prefetch={false}
            className="text-[0.8125rem] underline underline-offset-4"
          >
            {t("chooseAnother")}
          </Link>
        </div>
      ) : null}
      <FormField label={t("fieldTitle")} error={errors.title?.message} required>
        {(input) => (
          // `defaultValue`, so that the current value is there before hydration.
          <Input
            {...input}
            {...register("title")}
            defaultValue={doctor?.title ?? ""}
            dir="auto"
          />
        )}
      </FormField>
      <FormField
        label={t("registrationNumber")}
        hint={t("registrationHint")}
        error={errors.registration_number?.message}
      >
        {(input) => (
          <Input
            {...input}
            {...register("registration_number")}
            defaultValue={doctor?.registration_number ?? ""}
            dir="ltr"
          />
        )}
      </FormField>
      <Controller
        control={control}
        name="specialty_ids"
        render={({ field, fieldState }) => (
          <SpecialtyChoices
            options={specialties}
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <div>
        <Button type="submit" disabled={!hydrated || working}>
          {doctor
            ? working
              ? t("saving")
              : t("save")
            : working
              ? t("creating")
              : t("create")}
        </Button>
      </div>
    </form>
  );
}
