"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormField } from "@/components/shared/form/form-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useHydrated } from "@/features/auth/public";
import { allMessages, isOutcomeUnknown } from "@/lib/api/refusal";
import { useRouter } from "@/lib/i18n/navigation";
import { cancelCharge } from "../api/billing";
import { cancelFormSchema } from "../schemas/forms";

/**
 * Cancelling a charge with no money held, with a reason, after a confirmation that says it can't be undone and
 * that the visit can be charged again (FR-009). Sent once.
 */
export function CancelCharge({
  chargeId,
  onSucceeded,
  onOutcomeUnknown,
  onRefused,
}: {
  chargeId: number;
  onSucceeded: () => void;
  onOutcomeUnknown: () => void;
  /** A refusal's messages, kept by the page in case the refresh it causes removes this form. */
  onRefused: (messages: string[]) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("charges.cancel");
  const shared = useTranslations("shared.form");
  const hydrated = useHydrated();
  const router = useRouter();
  const inFlight = useRef(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();
  const [error, setError] = useState<string>();

  function close() {
    setOpen(false);
    setReasonError(undefined);
    setError(undefined);
  }

  async function confirm() {
    if (inFlight.current) return;
    const checked = cancelFormSchema({ reasonRule: t("reasonRule") }).safeParse(
      { reason },
    );
    if (!checked.success) {
      setReasonError(t("reasonRule"));
      return;
    }

    inFlight.current = true;
    setPending(true);
    setReasonError(undefined);
    setError(undefined);
    const result = await cancelCharge(chargeId, checked.data, locale);
    inFlight.current = false;
    setPending(false);

    if (result.ok) {
      close();
      setReason("");
      toast.success(t("done"));
      onSucceeded();
      router.refresh();
      return;
    }
    if (isOutcomeUnknown(result.error)) {
      close();
      onOutcomeUnknown();
      router.refresh();
      return;
    }

    const { reason: onReason = [], ...others } = result.error.fieldErrors;
    setReasonError(onReason.join(" ") || undefined);
    const rest = Object.values(others).flat();
    setError(
      rest.length > 0
        ? rest.join(" ")
        : onReason.length > 0
          ? undefined
          : (result.error.message ?? shared("generalFailure")),
    );
    onRefused(allMessages(result.error, shared("generalFailure")));
    // The charge most likely changed, so the page reads it again, and re-decides on a `403` or `404` (FR-014).
    router.refresh();
  }

  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="outline" disabled={!hydrated}>
          {t("action")}
        </Button>
      }
      title={t("title")}
      description={t("description")}
      confirmLabel={t("confirm")}
      cancelLabel={t("keep")}
      irreversible
      destructive
      pending={pending}
      error={error}
      onConfirm={() => void confirm()}
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
    >
      <FormField
        label={t("reasonLabel")}
        error={reasonError}
        required
        noMedicalDetails
      >
        {(input) => (
          <Textarea
            {...input}
            dir="auto"
            maxLength={500}
            value={reason}
            readOnly={pending}
            onChange={(event) => setReason(event.target.value)}
          />
        )}
      </FormField>
    </ConfirmDialog>
  );
}
