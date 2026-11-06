"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormError } from "@/components/shared/form/form-error";
import { FormField } from "@/components/shared/form/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/features/auth/public";
import { useFormSubmit } from "@/lib/api/use-form-submit";
import { useClearOnLeave } from "@/lib/use-clear-on-leave";
import { setStaffPassword } from "../api/staff";
import { type PasswordValues, passwordSchema } from "../schemas/staff";
import { useStaffFormText } from "./use-staff-form-text";

const FIELDS = ["password", "password_confirmation"] as const;

/** Never on one's own account: this ends every session, including the one in use. */
export function SetPasswordForm({ id, name }: { id: number; name: string }) {
  const locale = useLocale();
  const t = useTranslations("staff");
  const shared = useTranslations("shared.form");
  const hydrated = useHydrated();
  const text = useStaffFormText();
  const schema = useMemo(() => passwordSchema(text), [text]);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    resetField,
    formState: { errors },
  } = useForm<PasswordValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", password_confirmation: "" },
  });
  useClearOnLeave(resetField, FIELDS);
  const { working, formErrors, setFormErrors, submit } =
    useFormSubmit<PasswordValues>({
      fields: FIELDS,
      setError,
      generalFailure: shared("generalFailure"),
    });
  const [awaitingConfirmation, setAwaitingConfirmation] =
    useState<PasswordValues | null>(null);

  async function send(values: PasswordValues) {
    await submit(
      () => setStaffPassword(id, values, locale),
      () => {
        reset();
        toast.success(t("passwordSet"));
      },
    );
    setAwaitingConfirmation(null);
  }

  return (
    <form
      // POST, so that even a browser-handled submit can't put a password in the address.
      method="post"
      noValidate
      onSubmit={handleSubmit((values) => {
        setFormErrors([]);
        setAwaitingConfirmation(values);
      })}
      className="flex w-full max-w-md flex-col gap-4"
    >
      <FormError messages={formErrors} />
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
        <ConfirmDialog
          trigger={
            <Button
              type="submit"
              variant="outline"
              disabled={!hydrated || working}
            >
              {working ? t("settingPassword") : t("setPassword")}
            </Button>
          }
          title={t("passwordConfirmTitle", { name })}
          description={t("passwordConfirmDescription")}
          confirmLabel={t("setPassword")}
          destructive
          pending={working}
          open={awaitingConfirmation !== null}
          onOpenChange={(next) => {
            if (!next) setAwaitingConfirmation(null);
          }}
          onConfirm={() => {
            if (awaitingConfirmation) void send(awaitingConfirmation);
          }}
        />
      </div>
    </form>
  );
}
