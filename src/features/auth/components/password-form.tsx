"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { FormError } from "@/components/shared/form/form-error";
import { FormField } from "@/components/shared/form/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mapFieldErrors } from "@/lib/api/map-field-errors";
import { useClearOnLeave } from "@/lib/use-clear-on-leave";
import { changePassword } from "../api/change-password";
import {
  type ChangePasswordValues,
  changePasswordSchema,
} from "../schemas/change-password";
import { useHydrated } from "./use-hydrated";

export type PasswordFormText = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  passwordHint: string;
  submit: string;
  working: string;
  success: string;
  currentRequired: string;
  lengthRule: string;
  mismatch: string;
  generalFailure: string;
};

const FIELDS = [
  "current_password",
  "password",
  "password_confirmation",
] as const;

export function PasswordForm({ text }: { text: PasswordFormText }) {
  const locale = useLocale();
  const hydrated = useHydrated();
  const schema = useMemo(() => changePasswordSchema(text), [text]);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    resetField,
    formState: { errors },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      current_password: "",
      password: "",
      password_confirmation: "",
    },
  });
  useClearOnLeave(resetField, FIELDS);
  const [working, setWorking] = useState(false);
  const [changed, setChanged] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  async function onSubmit(values: ChangePasswordValues) {
    if (working) return;
    setWorking(true);
    setChanged(false);
    setFormErrors([]);

    const result = await changePassword(values, locale);
    setWorking(false);

    if (result.ok) {
      reset();
      setChanged(true);
      return;
    }

    setFormErrors(
      mapFieldErrors(result.error, FIELDS, setError, text.generalFailure),
    );
  }

  return (
    <form
      // POST, so that even a browser-handled submit can't put these fields in the address.
      method="post"
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="flex max-w-md flex-col gap-4"
    >
      <FormError messages={formErrors} />
      {changed ? (
        <p role="status" className="font-medium">
          {text.success}
        </p>
      ) : null}
      <FormField
        label={text.currentPassword}
        error={errors.current_password?.message}
        required
      >
        {(input) => (
          <Input
            {...input}
            {...register("current_password")}
            type="password"
            dir="ltr"
            autoComplete="current-password"
          />
        )}
      </FormField>
      <FormField
        label={text.newPassword}
        hint={text.passwordHint}
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
        label={text.confirmPassword}
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
          {working ? text.working : text.submit}
        </Button>
      </div>
    </form>
  );
}
