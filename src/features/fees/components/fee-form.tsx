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
import { useHydrated } from "@/features/auth/public";
import { useFormSubmit } from "@/lib/api/use-form-submit";
import { useRouter } from "@/lib/i18n/navigation";
import { setFee } from "../api/fees";
import { type FeeFormValues, feeFormSchema } from "../schemas/fee";

const FIELDS = ["amount"] as const;

export function FeeForm({
  doctorId,
  hasFee,
}: {
  doctorId: number;
  hasFee: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("fees");
  const shared = useTranslations("shared.form");
  const hydrated = useHydrated();
  const router = useRouter();
  const schema = useMemo(
    () => feeFormSchema({ amountRule: t("amountRule") }),
    [t],
  );
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<FeeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: "" },
  });
  const { working, formErrors, submit } = useFormSubmit<FeeFormValues>({
    fields: FIELDS,
    setError,
    generalFailure: shared("generalFailure"),
  });

  function onSubmit(values: FeeFormValues) {
    return submit(
      () => setFee(doctorId, values, locale),
      () => {
        reset();
        toast.success(t("saved"));
        router.refresh();
      },
    );
  }

  return (
    <form
      method="post"
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="flex w-full max-w-sm flex-col gap-3"
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
          />
        )}
      </FormField>
      <p className="text-[0.8125rem] text-muted-foreground">
        {t("chargesNote")}
      </p>
      <div>
        <Button type="submit" disabled={!hydrated || working}>
          {working ? t("saving") : hasFee ? t("change") : t("set")}
        </Button>
      </div>
    </form>
  );
}
