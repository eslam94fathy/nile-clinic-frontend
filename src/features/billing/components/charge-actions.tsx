"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useRole } from "@/features/auth/public";
import { FormError } from "@/components/shared/form/form-error";
import {
  type ChargeAction,
  offeredChargeActions,
} from "../offered-charge-actions";
import type { Charge } from "../types";
import { CancelCharge } from "./cancel-charge";
import { DiscountForm } from "./discount-form";
import { OutcomeUnknownNotice } from "./outcome-unknown-notice";
import { PaymentForm } from "./payment-form";
import { RefundForm } from "./refund-form";

/**
 * What this person may do with this charge, from its status and amounts and their role (research R8). It's UX
 * only: the API decides each action. The notice about an unknown outcome lives here, so that it outlasts the
 * page's refresh, and it clears on the next action that succeeds.
 */
export function ChargeActions({
  charge,
  justCharged,
}: {
  charge: Charge;
  /** The address says Billing has just charged this visit. */
  justCharged: boolean;
}) {
  const t = useTranslations("charges.details");
  const role = useRole();
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);
  const [refusal, setRefusal] = useState<{
    action: ChargeAction;
    messages: string[];
  } | null>(null);
  const offered = role ? offeredChargeActions(charge, role) : [];

  // Once only: a reload, or coming back, mustn't move the focus again. Only the address changes, so the charge isn't
  // read a second time; Next.js keeps its router in step with `history.replaceState`.
  useEffect(() => {
    if (!justCharged) return;
    const address = new URL(window.location.href);
    address.searchParams.delete("charged");
    window.history.replaceState(window.history.state, "", address);
  }, [justCharged]);

  const handlersFor = (action: ChargeAction) => ({
    onSucceeded: () => {
      setOutcomeUnknown(false);
      setRefusal(null);
    },
    onOutcomeUnknown: () => setOutcomeUnknown(true),
    onRefused: (messages: string[]) => setRefusal({ action, messages }),
  });

  return (
    <div className="flex flex-col gap-8">
      {/* A form shows its own refusal. When the refresh after one has removed that form, it would be lost. */}
      {refusal && !offered.includes(refusal.action) ? (
        <FormError messages={refusal.messages} />
      ) : null}
      {offered.includes("pay") ? (
        <PaymentForm
          charge={charge}
          focusOnMount={justCharged}
          {...handlersFor("pay")}
        />
      ) : null}
      {offered.includes("refund") ? (
        <RefundForm charge={charge} {...handlersFor("refund")} />
      ) : null}
      {offered.includes("discount") ? (
        <DiscountForm charge={charge} {...handlersFor("discount")} />
      ) : null}
      {offered.includes("cancel") ? (
        <div>
          <CancelCharge chargeId={charge.id} {...handlersFor("cancel")} />
        </div>
      ) : null}
      {offered.length === 0 && charge.status !== "cancelled" ? (
        <p className="text-muted-foreground">{t("nothingOffered")}</p>
      ) : null}
      <OutcomeUnknownNotice shown={outcomeUnknown} />
    </div>
  );
}
