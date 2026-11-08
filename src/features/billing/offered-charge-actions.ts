import { can, type Role } from "@/lib/auth/permissions";
import { compareAmounts } from "@/lib/format/amount";
import type { Charge } from "./types";

export type ChargeAction = "pay" | "cancel" | "discount" | "refund";

const above = (amount: string, than: string) =>
  compareAmounts(amount, than) === 1;

/**
 * What a charge's page offers, from the charge as the API sent it (data-model, "What a charge offers"). It only
 * decides what's shown: the API decides each action, and its answer wins. In a fixed order, so the page is stable.
 */
export function offeredChargeActions(
  charge: Pick<Charge, "status" | "amount_paid" | "balance">,
  role: Role,
): ChargeAction[] {
  if (charge.status === "cancelled") return [];

  const held = above(charge.amount_paid, "0.00");
  const offered: ChargeAction[] = [];
  if (can(role, "billing")) {
    if (above(charge.balance, "0.00")) offered.push("pay");
    if (!held) offered.push("cancel");
  }
  if (can(role, "discountAndRefund")) {
    offered.push("discount");
    if (held) offered.push("refund");
  }
  return offered;
}
