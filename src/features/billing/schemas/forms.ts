import { z } from "zod";
import { compareAmounts, isAmount, normalizeAmount } from "@/lib/format/amount";
import { PAYMENT_METHODS } from "../types";

// Checks before sending, for faster feedback only: the API decides each one (FR-015). Amounts stay text.

const REASON_MAX = 500;

const amount = (rule: string, options: { allowZero?: boolean } = {}) =>
  z
    .string()
    .transform(normalizeAmount)
    .refine((value) => isAmount(value, options), { error: rule });

/** At most `limit`, compared on the digits, once the amount is known to be one. */
const isWithin = (amountText: string, limit: string) =>
  !isAmount(amountText) || compareAmounts(amountText, limit) !== 1;

// No method is chosen at first, so that whatever is recorded is one somebody picked (research R7).
const method = (rule: string) =>
  z
    .union([z.enum(PAYMENT_METHODS), z.literal("")])
    .refine((value) => value !== "", {
      error: rule,
    });

const reason = (rule: string) =>
  z
    .string()
    .refine((value) => value.trim() !== "" && value.length <= REASON_MAX, {
      error: rule,
    });

export function paymentFormSchema(
  text: { amountRule: string; aboveBalance: string; methodRule: string },
  balance: string,
) {
  return z
    .object({
      amount: amount(text.amountRule),
      method: method(text.methodRule),
    })
    .refine((value) => isWithin(value.amount, balance), {
      error: text.aboveBalance,
      path: ["amount"],
    });
}

export function refundFormSchema(
  text: {
    amountRule: string;
    abovePaid: string;
    methodRule: string;
    reasonRule: string;
  },
  amountPaid: string,
) {
  return z
    .object({
      amount: amount(text.amountRule),
      method: method(text.methodRule),
      reason: reason(text.reasonRule),
    })
    .refine((value) => isWithin(value.amount, amountPaid), {
      error: text.abovePaid,
      path: ["amount"],
    });
}

/** The limit against the fee less what's paid is the API's to report, on `amount` (data-model). */
export function discountFormSchema(text: {
  amountRule: string;
  reasonRule: string;
}) {
  return z.object({
    amount: amount(text.amountRule, { allowZero: true }),
    reason: reason(text.reasonRule),
  });
}

export function cancelFormSchema(text: { reasonRule: string }) {
  return z.object({ reason: reason(text.reasonRule) });
}

export type PaymentFormInput = z.input<ReturnType<typeof paymentFormSchema>>;
export type PaymentFormValues = z.output<ReturnType<typeof paymentFormSchema>>;
export type RefundFormInput = z.input<ReturnType<typeof refundFormSchema>>;
export type RefundFormValues = z.output<ReturnType<typeof refundFormSchema>>;
export type DiscountFormValues = z.output<
  ReturnType<typeof discountFormSchema>
>;
export type CancelFormValues = z.output<ReturnType<typeof cancelFormSchema>>;
