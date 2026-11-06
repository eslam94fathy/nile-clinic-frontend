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
import { safeReturnAddress } from "@/lib/auth/return-address";
import { signIn } from "../api/sign-in";
import { type SignInValues, signInSchema } from "../schemas/sign-in";
import { useHydrated } from "./use-hydrated";

export type SignInFormText = {
  email: string;
  password: string;
  submit: string;
  working: string;
  emailRequired: string;
  passwordRequired: string;
  generalFailure: string;
};

const FIELDS = ["email", "password"] as const;

export function SignInForm({ text }: { text: SignInFormText }) {
  const locale = useLocale();
  const hydrated = useHydrated();
  const schema = useMemo(() => signInSchema(text), [text]);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignInValues>({ resolver: zodResolver(schema) });
  const [working, setWorking] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  async function onSubmit(values: SignInValues) {
    if (working) return;
    setWorking(true);
    setFormErrors([]);

    const result = await signIn(values, locale);
    if (result.ok) {
      // A full navigation, so that nothing from before sign-in stays in memory. Stays "working" until then.
      const target =
        safeReturnAddress(
          new URLSearchParams(window.location.search).get("return"),
        ) ?? "/dashboard";
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- must be a full navigation
      window.location.assign(`/${locale}${target}`);
      return;
    }

    setFormErrors(
      mapFieldErrors(result.error, FIELDS, setError, text.generalFailure),
    );
    setWorking(false);
  }

  return (
    <form
      // POST, so that even a browser-handled submit can't put these fields in the address.
      method="post"
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
    >
      <FormError messages={formErrors} />
      <FormField label={text.email} error={errors.email?.message} required>
        {(input) => (
          <Input
            {...input}
            {...register("email")}
            type="email"
            dir="ltr"
            autoComplete="username"
          />
        )}
      </FormField>
      <FormField
        label={text.password}
        error={errors.password?.message}
        required
      >
        {(input) => (
          <Input
            {...input}
            {...register("password")}
            type="password"
            dir="ltr"
            autoComplete="current-password"
          />
        )}
      </FormField>
      <Button type="submit" disabled={!hydrated || working}>
        {working ? text.working : text.submit}
      </Button>
    </form>
  );
}
