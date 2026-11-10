"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormError } from "@/components/shared/form/form-error";
import { FormField } from "@/components/shared/form/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useHydrated } from "@/features/auth/public";
import type { ApiError } from "@/lib/api/api-error";
import { allMessages, isOutcomeUnknown } from "@/lib/api/refusal";
import { useFormSubmit } from "@/lib/api/use-form-submit";
import { useRouter } from "@/lib/i18n/navigation";
import { setDiscount } from "../api/billing";
import { type DiscountFormValues, discountFormSchema } from "../schemas/forms";
import type { Charge } from "../types";

const FIELDS = ["amount", "reason"] as const;

/**
 * An administrator's discount, which replaces any earlier one; zero removes it (FR-010). There's no confirmation,
 * as it can be replaced, and the API records each one with its reason. The fee itself never changes.
 */
export function DiscountForm({
  charge,
  onSucceeded,
  onOutcomeUnknown,
  onRefused,
}: {
  charge: Pick<Charge, "id" | "discount">;
  onSucceeded: () => void;
  onOutcomeUnknown: () => void;
  /** A refusal's messages, kept by the page in case the refresh it causes removes this form. */
  onRefused: (messages: string[]) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("charges.discount");
  const shared = useTranslations("shared.form");
  const hydrated = useHydrated();
  const router = useRouter();
  const schema = useMemo(
    () =>
      discountFormSchema({
        amountRule: t("amountRule"),
        reasonRule: t("reasonRule"),
      }),
    [t],
  );
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<DiscountFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: charge.discount, reason: "" },
  });
  const { working, formErrors, setFormErrors, submit } =
    useFormSubmit<DiscountFormValues>({
      fields: FIELDS,
      setError,
      generalFailure: shared("generalFailure"),
    });

  function onFailure(error: ApiError) {
    if (isOutcomeUnknown(error)) {
      setFormErrors([]);
      onOutcomeUnknown();
    } else {
      onRefused(allMessages(error, shared("generalFailure")));
    }
    if (error.status !== 403 && error.status !== 404) router.refresh();
  }

  function onSubmit(values: DiscountFormValues) {
    return submit(
      () => setDiscount(charge.id, values, locale),
      (answer) => {
        reset({ amount: answer.discount, reason: "" });
        toast.success(t("done"));
        onSucceeded();
        router.refresh();
      },
      onFailure,
    );
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="discount-heading">
      <h2 id="discount-heading" className="text-xl font-semibold">
        {t("heading")}
      </h2>
      <form
        method="post"
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="flex w-full max-w-md flex-col gap-4"
      >
        <FormError messages={formErrors} />
        <FormField
          label={t("amountLabel")}
          hint={t("amountHint")}
          error={errors.amount?.message}
          required
        >
          {(input) => (
            <Input
              {...input}
              {...register("amount")}
              dir="ltr"
              inputMode="decimal"
              autoComplete="off"
              readOnly={working}
            />
          )}
        </FormField>
        <FormField
          label={t("reasonLabel")}
          error={errors.reason?.message}
          required
          noMedicalDetails
        >
          {(input) => (
            <Textarea
              {...input}
              {...register("reason")}
              dir="auto"
              maxLength={500}
              readOnly={working}
            />
          )}
        </FormField>
        <div>
          <Button type="submit" disabled={!hydrated || working}>
            {working ? t("saving") : t("submit")}
          </Button>
        </div>
      </form>
    </section>
  );
}
