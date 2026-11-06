import { z } from "zod";
import { toWesternDigits } from "@/lib/format/digits";
import type { DoctorFee } from "../types";

export const doctorFeeSchema = z.object({
  doctor: z.object({ id: z.number(), name: z.string(), title: z.string() }),
  amount: z.string().nullable(),
  set_at: z.string().nullable(),
  set_by: z.object({ id: z.number(), name: z.string() }).nullable(),
}) satisfies z.ZodType<DoctorFee>;

const AMOUNT = /^\d+(\.\d{1,2})?$/;

/**
 * Above 0, at most 100000, at most two decimals. These are checks on the text, since money is never turned
 * into a number here (constitution V).
 */
export function isValidFeeAmount(amount: string): boolean {
  if (!AMOUNT.test(amount)) return false;

  const [whole = "", decimals = ""] = amount.split(".");
  const digits = whole.replace(/^0+/, "");
  const noDecimals = !/[1-9]/.test(decimals);

  if (digits === "" && noDecimals) return false;
  if (digits.length < 6) return true;
  return digits === "100000" && noDecimals;
}

export function feeFormSchema(text: { amountRule: string }) {
  return z.object({
    amount: z
      .string()
      .transform((value) => toWesternDigits(value).trim())
      .refine(isValidFeeAmount, { error: text.amountRule }),
  });
}

export type FeeFormValues = z.output<ReturnType<typeof feeFormSchema>>;
