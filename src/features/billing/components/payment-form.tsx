"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormError } from "@/components/shared/form/form-error";
import { FormField } from "@/components/shared/form/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/features/auth/public";
import type { ApiError } from "@/lib/api/api-error";
import { allMessages, isOutcomeUnknown } from "@/lib/api/refusal";
import { useFormSubmit } from "@/lib/api/use-form-submit";
import { toMoneyText } from "@/lib/format/amount";
import { formatMoney } from "@/lib/format/money";
import { useRouter } from "@/lib/i18n/navigation";
import { recordPayment } from "../api/billing";
import {
  type PaymentFormInput,
  type PaymentFormValues,
  paymentFormSchema,
} from "../schemas/forms";
import type { Charge, PaymentMethod } from "../types";
import { MethodChoice } from "./method-choice";

const FIELDS = ["amount", "method"] as const;

type Confirmed = { amount: string; method: PaymentMethod };

/**
 * Money received, checked here, confirmed in a dialog, and sent once (research R4, R7). The amount starts as the
 * whole balance; no method is chosen. A payment can't be edited afterwards, so the dialog says so.
 */
export function PaymentForm({
  charge,
  focusOnMount = false,
  onSucceeded,
  onOutcomeUnknown,
  onRefused,
}: {
  charge: Charge;
  /** Straight after charging a visit, so the next keystrokes land here. */
  focusOnMount?: boolean;
  onSucceeded: () => void;
  onOutcomeUnknown: () => void;
  /** A refusal's messages, kept by the page in case the refresh it causes removes this form. */
  onRefused: (messages: string[]) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("charges.payment");
  const tHow = useTranslations("charges.methodPhrase");
  const shared = useTranslations("shared.form");
  const hydrated = useHydrated();
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);
  const submitButton = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState<Confirmed | null>(null);

  const schema = useMemo(
    () =>
      paymentFormSchema(
        {
          amountRule: t("amountRule"),
          aboveBalance: t("aboveBalance"),
          methodRule: t("methodRule"),
        },
        charge.balance,
      ),
    [t, charge.balance],
  );
  const {
    register,
    handleSubmit,
    setError,
    reset,
    setValue,
    getFieldState,
    formState: { errors },
  } = useForm<PaymentFormInput, unknown, PaymentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: charge.balance, method: "" },
  });
  const { working, formErrors, setFormErrors, submit } =
    useFormSubmit<PaymentFormInput>({
      fields: FIELDS,
      setError,
      generalFailure: shared("generalFailure"),
    });

  useEffect(() => {
    if (focusOnMount) heading.current?.focus();
  }, [focusOnMount]);

  // A discount, refund, or someone else's payment changes the balance under the form. The amount follows it, unless
  // the person has typed one, which is kept, as after an unknown outcome (research R4).
  // Only when the balance itself changes: after this form's own success, `reset` has already set it.
  const shownBalance = useRef(charge.balance);
  useEffect(() => {
    if (shownBalance.current === charge.balance) return;
    shownBalance.current = charge.balance;
    if (!getFieldState("amount").isDirty) setValue("amount", charge.balance);
  }, [charge.balance, getFieldState, setValue]);

  function onChecked(values: PaymentFormValues) {
    setConfirming({ amount: values.amount, method: values.method });
  }

  function onFailure(error: ApiError) {
    setConfirming(null);
    if (isOutcomeUnknown(error)) {
      // Not a refusal: the payment may be recorded. What was typed stays, and nothing is sent again (FR-013).
      setFormErrors([]);
      onOutcomeUnknown();
    } else {
      onRefused(allMessages(error, shared("generalFailure")));
    }
    // A refusal usually means the charge changed, so the page reads it again (FR-014). `useFormSubmit` already
    // refreshes on a `403` or `404`.
    if (error.status !== 403 && error.status !== 404) router.refresh();
  }

  function confirm() {
    if (!confirming) return;
    const sent = confirming;
    void submit(
      () => recordPayment(charge.id, sent, locale),
      (answer) => {
        setConfirming(null);
        toast.success(
          t("done", {
            amount: formatMoney(toMoneyText(sent.amount), locale) ?? "",
            how: tHow(sent.method),
          }),
        );
        reset({ amount: answer.balance, method: "" });
        onSucceeded();
        router.refresh();
      },
      onFailure,
    );
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="payment-heading">
      <h2
        id="payment-heading"
        ref={heading}
        tabIndex={-1}
        className="text-xl font-semibold outline-none"
      >
        {t("heading")}
      </h2>
      <form
        method="post"
        noValidate
        onSubmit={handleSubmit(onChecked)}
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
        <div>
          <Button
            ref={submitButton}
            type="submit"
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
