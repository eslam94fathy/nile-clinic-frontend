import { z } from "zod";
import type { Doctor, DoctorSummary } from "../types";
import { specialtySchema } from "./specialty";

export const doctorSummarySchema = z.object({
  id: z.number(),
  name: z.string(),
  title: z.string(),
  is_active: z.boolean(),
  specialties: z.array(specialtySchema),
}) satisfies z.ZodType<DoctorSummary>;

export const doctorSchema = doctorSummarySchema.extend({
  registration_number: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
}) satisfies z.ZodType<Doctor>;

export function doctorFormSchema(text: {
  titleRequired: string;
  titleTooLong: string;
  specialtiesRequired: string;
}) {
  return z.object({
    // Only a place for the API's refusal to appear: the account is fixed, and never typed here.
    user_id: z.number().optional(),
    title: z
      .string()
      .trim()
      .min(1, text.titleRequired)
      .max(100, text.titleTooLong),
    registration_number: z.string().trim(),
    specialty_ids: z.array(z.number()).min(1, text.specialtiesRequired),
  });
}

export type DoctorFormValues = z.output<ReturnType<typeof doctorFormSchema>>;

export type DoctorCreateBody = {
  user_id: number;
  title: string;
  registration_number?: string;
  specialty_ids: number[];
};

export type DoctorUpdateBody = {
  title?: string;
  registration_number?: string | null;
  specialty_ids?: number[];
};

/** A blank number is left out when creating. */
export function toCreateBody(
  userId: number,
  values: DoctorFormValues,
): DoctorCreateBody {
  return {
    user_id: userId,
    title: values.title,
    specialty_ids: values.specialty_ids,
    ...(values.registration_number
      ? { registration_number: values.registration_number }
      : {}),
  };
}

function sameSet(a: readonly number[], b: readonly number[]) {
  return a.length === b.length && a.every((id) => b.includes(id));
}

/** Only what changed. A number that's been cleared is sent as `null`, and `specialty_ids` is the whole set. */
export function toUpdateBody(
  doctor: Doctor,
  values: DoctorFormValues,
): DoctorUpdateBody {
  const number = values.registration_number || null;
  const current = doctor.specialties.map(({ id }) => id);

  return {
    ...(values.title === doctor.title ? {} : { title: values.title }),
    ...(number === doctor.registration_number
      ? {}
      : { registration_number: number }),
    ...(sameSet(values.specialty_ids, current)
      ? {}
      : { specialty_ids: values.specialty_ids }),
  };
}
