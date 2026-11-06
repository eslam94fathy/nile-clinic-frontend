"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormError } from "@/components/shared/form/form-error";
import { FormField } from "@/components/shared/form/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/features/auth/public";
import { useFormSubmit } from "@/lib/api/use-form-submit";
import { useRouter } from "@/lib/i18n/navigation";
import { createSpecialty, renameSpecialty } from "../api/specialties";
import {
  type SpecialtyFormValues,
  specialtyFormSchema,
} from "../schemas/specialty";
import type { Specialty } from "../types";

const FIELDS = ["name_en", "name_ar"] as const;

/** Adds a specialty, or renames the one it's given. */
export function SpecialtyForm({
  specialty,
  onDone,
}: {
  specialty?: Specialty;
  onDone?: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("specialties");
  const shared = useTranslations("shared.form");
  const hydrated = useHydrated();
  const router = useRouter();
  const schema = useMemo(
    () =>
      specialtyFormSchema({
        nameRequired: t("nameRequired"),
        nameTooLong: t("nameTooLong"),
      }),
    [t],
  );
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    reset,
    formState: { errors },
  } = useForm<SpecialtyFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name_en: specialty?.name_en ?? "",
      name_ar: specialty?.name_ar ?? "",
    },
  });
  const { working, formErrors, setFormErrors, submit } =
    useFormSubmit<SpecialtyFormValues>({
      fields: FIELDS,
      setError,
      generalFailure: shared("generalFailure"),
    });

  const renaming = specialty !== undefined;

  useEffect(() => {
    if (renaming) setFocus("name_en");
  }, [renaming, setFocus]);

  async function onSubmit(values: SpecialtyFormValues) {
    if (!specialty) {
      await submit(
        () => createSpecialty(values, locale),
        () => {
          reset();
          toast.success(t("added"));
          router.refresh();
        },
      );
      return;
    }

    const changes: Partial<SpecialtyFormValues> = {
      ...(values.name_en === specialty.name_en
        ? {}
        : { name_en: values.name_en }),
      ...(values.name_ar === specialty.name_ar
        ? {}
        : { name_ar: values.name_ar }),
    };
    if (Object.keys(changes).length === 0) {
      setFormErrors([shared("nothingToSave")]);
      return;
    }

    await submit(
      () => renameSpecialty(specialty.id, changes, locale),
      () => {
        toast.success(t("renamed"));
        router.refresh();
        onDone?.();
      },
    );
  }

  return (
    <form
      method="post"
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="flex max-w-xl flex-col gap-4"
    >
      <FormError messages={formErrors} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t("nameEn")} error={errors.name_en?.message} required>
          {(input) => (
            <Input
              {...input}
              {...register("name_en")}
              dir="ltr"
              maxLength={200}
            />
          )}
        </FormField>
        <FormField label={t("nameAr")} error={errors.name_ar?.message} required>
          {(input) => (
            <Input
              {...input}
              {...register("name_ar")}
              dir="rtl"
              maxLength={200}
            />
          )}
        </FormField>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={!hydrated || working}>
          {renaming
            ? working
              ? t("saving")
              : t("save")
            : working
              ? t("adding")
              : t("add")}
        </Button>
        {renaming ? (
          <Button type="button" variant="outline" onClick={onDone}>
            {t("cancel")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
