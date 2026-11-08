"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormError } from "@/components/shared/form/form-error";
import { FormField } from "@/components/shared/form/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useHydrated } from "@/features/auth/public";
import type { ApiError } from "@/lib/api/api-error";
import { allMessages, isOutcomeUnknown } from "@/lib/api/refusal";
import { useFormSubmit } from "@/lib/api/use-form-submit";
import { toMoneyText } from "@/lib/format/amount";
import { formatMoney } from "@/lib/format/money";
import { useRouter } from "@/lib/i18n/navigation";
import { recordRefund } from "../api/billing";
import {
  type RefundFormInput,
  type RefundFormValues,
  refundFormSchema,
} from "../schemas/forms";
import type { Charge, PaymentMethod } from "../types";
import { MethodChoice } from "./method-choice";

const FIELDS = ["amount", "method", "reason"] as const;

type Confirmed = { amount: string; method: PaymentMethod; reason: string };

/**
 * An administrator's record of money returned, which is how a payment is corrected, as payments can't be changed
 * (FR-011). Confirmed, and sent once. The original payment stays on record.
 */
export function RefundForm({
  charge,
  onSucceeded,
  onOutcomeUnknown,
  onRefused,
}: {
  charge: Pick<Charge, "id" | "amount_paid" | "patient">;
  onSucceeded: () => void;
  onOutcomeUnknown: () => void;
  /** A refusal's messages, kept by the page in case the refresh it causes removes this form. */
  onRefused: (messages: string[]) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("charges.refund");
  const tHow = useTranslations("charges.methodPhrase");
  const shared = useTranslations("shared.form");
  const hydrated = useHydrated();
  const router = useRouter();
  const submitButton = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState<Confirmed | null>(null);

  const schema = useMemo(
    () =>
      refundFormSchema(
        {
          amountRule: t("amountRule"),
          abovePaid: t("abovePaid"),
          methodRule: t("methodRule"),
          reasonRule: t("reasonRule"),
        },
        charge.amount_paid,
      ),
    [t, charge.amount_paid],
  );
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<RefundFormInput, unknown, RefundFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: "", method: "", reason: "" },
  });
  const { working, formErrors, setFormErrors, submit } =
    useFormSubmit<RefundFormInput>({
      fields: FIELDS,
      setError,
      generalFailure: shared("generalFailure"),
    });

  function onFailure(error: ApiError) {
    setConfirming(null);
    if (isOutcomeUnknown(error)) {
      setFormErrors([]);
      onOutcomeUnknown();
    } else {
      onRefused(allMessages(error, shared("generalFailure")));
    }
    if (error.status !== 403 && error.status !== 404) router.refresh();
  }

  function confirm() {
    if (!confirming) return;
    const sent = confirming;
    void submit(
      () => recordRefund(charge.id, sent, locale),
      () => {
        setConfirming(null);
        toast.success(
          t("done", {
            amount: formatMoney(toMoneyText(sent.amount), locale) ?? "",
            how: tHow(sent.method),
          }),
        );
        reset({ amount: "", method: "", reason: "" });
        onSucceeded();
        router.refresh();
      },
      onFailure,
    );
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="refund-heading">
      <h2 id="refund-heading" className="text-xl font-semibold">
        {t("heading")}
      </h2>
      <form
        method="post"
        noValidate
        onSubmit={handleSubmit((values) => setConfirming(values))}
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
        <MethodChoice
          legend={t("methodLabel")}
          error={errors.method?.message}
          disabled={working}
          registration={register("method")}
        />
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
          <Button
            ref={submitButton}
            type="submit"
            variant="outline"
            disabled={!hydrated || working}
          >
            {t("submit")}
          </Button>
        </div>
      </form>
      <ConfirmDialog
        title={t("confirmTitle")}
        description={
          confirming
            ? t("confirmDescription", {
                amount:
                  formatMoney(toMoneyText(confirming.amount), locale) ?? "",
                how: tHow(confirming.method),
                name: charge.patient.full_name,
              })
            : null
        }
        confirmLabel={t("confirm")}
        pending={working}
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        onConfirm={confirm}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          submitButton.current?.focus();
        }}
      />
    </section>
  );
}
