import { z } from "zod";
import type { Specialty } from "../types";

export const specialtySchema = z.object({
  id: z.number(),
  name_en: z.string(),
  name_ar: z.string(),
  is_active: z.boolean(),
}) satisfies z.ZodType<Specialty>;

export function specialtyFormSchema(text: {
  nameRequired: string;
  nameTooLong: string;
}) {
  const name = z
    .string()
    .trim()
    .min(1, text.nameRequired)
    .max(100, text.nameTooLong);
  return z.object({ name_en: name, name_ar: name });
}

export type SpecialtyFormValues = z.output<
  ReturnType<typeof specialtyFormSchema>
>;
