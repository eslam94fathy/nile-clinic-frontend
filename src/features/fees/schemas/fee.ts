import { z } from "zod";
import { isAmount, normalizeAmount } from "@/lib/format/amount";
import type { DoctorFee } from "../types";

export const doctorFeeSchema = z.object({
  doctor: z.object({ id: z.number(), name: z.string(), title: z.string() }),
  amount: z.string().nullable(),
  set_at: z.string().nullable(),
  set_by: z.object({ id: z.number(), name: z.string() }).nullable(),
}) satisfies z.ZodType<DoctorFee>;

export function feeFormSchema(text: { amountRule: string }) {
  return z.object({
    amount: z
      .string()
      .transform(normalizeAmount)
      // Above 0, at most 100000, at most two decimals, checked on the text (constitution V).
      .refine((amount) => isAmount(amount), { error: text.amountRule }),
  });
}

export type FeeFormValues = z.output<ReturnType<typeof feeFormSchema>>;
