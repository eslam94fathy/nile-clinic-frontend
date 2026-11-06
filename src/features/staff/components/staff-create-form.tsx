"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { FormError } from "@/components/shared/form/form-error";
import { FormField } from "@/components/shared/form/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { type StaffMember, useHydrated } from "@/features/auth/public";
import { useFormSubmit } from "@/lib/api/use-form-submit";
import { useRouter } from "@/lib/i18n/navigation";
import { createStaffMember } from "../api/staff";
import {
  STAFF_ROLES,
  type StaffCreateValues,
  staffCreateSchema,
} from "../schemas/staff";
import { useStaffFormText } from "./use-staff-form-text";

const FIELDS = [
  "name",
  "email",
  "role",
  "password",
  "password_confirmation",
] as const;

const createdSchema = z.object({ data: z.object({ id: z.number() }) });

export function StaffCreateForm({
  defaultRole,
}: {
  defaultRole?: StaffMember["role"];
}) {
  const locale = useLocale();
  const t = useTranslations("staff");
  const roles = useTranslations("roles");
  const shared = useTranslations("shared.form");
  const hydrated = useHydrated();
  const router = useRouter();
  const text = useStaffFormText();
  const schema = useMemo(() => staffCreateSchema(text), [text]);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<z.input<typeof schema>, unknown, StaffCreateValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      ...(defaultRole ? { role: defaultRole } : {}),
      password: "",
      password_confirmation: "",
    },
  });
  const { working, formErrors, submit } = useFormSubmit<z.input<typeof schema>>(
    { fields: FIELDS, setError, generalFailure: shared("generalFailure") },
  );

  function onSubmit(values: StaffCreateValues) {
    return submit(
      () => createStaffMember(values, locale),
      (data) => {
        const created = createdSchema.safeParse(data);
        if (!created.success) {
          router.push("/staff");
          return;
        }
        const { id } = created.data.data;
        if (values.role === "doctor") {
          toast.success(t("createdDoctor"));
          router.push(`/doctors/new?account=${id}`);
        } else {
          toast.success(t("created"));
          router.push(`/staff/${id}`);
        }
      },
    );
  }

  return (
    <form
      // POST, so that even a browser-handled submit can't put a password in the address.
      method="post"
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="flex max-w-md flex-col gap-4"
    >
      <FormError messages={formErrors} />
      <FormField label={t("name")} error={errors.name?.message} required>
        {(input) => (
          <Input
            {...input}
            {...register("name")}
            dir="auto"
            autoComplete="off"
          />
        )}
      </FormField>
      <FormField label={t("email")} error={errors.email?.message} required>
        {(input) => (
          <Input
            {...input}
            {...register("email")}
            type="email"
            dir="ltr"
            autoComplete="off"
          />
        )}
      </FormField>
      <FormField label={t("role")} error={errors.role?.message} required>
        {(input) => (
          <NativeSelect {...input} {...register("role")} className="w-full">
            <NativeSelectOption value="">{t("chooseRole")}</NativeSelectOption>
            {STAFF_ROLES.map((role) => (
              <NativeSelectOption key={role} value={role}>
                {roles(role)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField
        label={t("password")}
        hint={t("passwordHint")}
        error={errors.password?.message}
        required
      >
        {(input) => (
          <Input
            {...input}
            {...register("password")}
            type="password"
            dir="ltr"
            autoComplete="new-password"
          />
        )}
      </FormField>
      <FormField
        label={t("passwordConfirmation")}
        error={errors.password_confirmation?.message}
        required
      >
        {(input) => (
          <Input
            {...input}
            {...register("password_confirmation")}
            type="password"
            dir="ltr"
            autoComplete="new-password"
          />
        )}
      </FormField>
      <div>
        <Button type="submit" disabled={!hydrated || working}>
          {working ? t("creating") : t("create")}
        </Button>
      </div>
    </form>
  );
}
