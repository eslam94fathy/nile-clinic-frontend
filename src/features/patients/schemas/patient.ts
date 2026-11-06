import { z } from "zod";
import { toWesternDigits } from "@/lib/format/digits";
import type { Patient, PatientSummary } from "../types";

export const SEXES = ["male", "female"] as const;

const PHONE = /^\+?[0-9]{8,15}$/;
const NATIONAL_ID = /^[23][0-9]{13}$/;

// Checks what crosses the browser boundary. The types come from the contract, not from here.
export const patientSummarySchema = z.object({
  id: z.number(),
  full_name: z.string(),
  sex: z.enum(SEXES),
  date_of_birth: z.string(),
  phone: z.string(),
}) satisfies z.ZodType<PatientSummary>;

export const patientSchema = patientSummarySchema.extend({
  national_id: z.string().nullable(),
  address: z.string().nullable(),
  emergency_contact: z
    .object({
      name: z.string(),
      relationship: z.string(),
      phone: z.string(),
    })
    .nullable(),
  created_at: z.string(),
  updated_at: z.string(),
}) satisfies z.ZodType<Patient>;

/** What the API does to a phone before checking it, so that comparing with a stored one is fair. */
export function normalizePhone(value: string): string {
  return toWesternDigits(value).replace(/[\s\-()]/gu, "");
}

export function normalizeNationalId(value: string): string {
  return toWesternDigits(value).trim();
}

export type PatientFormText = {
  nameRequired: string;
  nameTooLong: string;
  dateRequired: string;
  dateRange: string;
  sexRequired: string;
  phoneRule: string;
  nationalIdRule: string;
  addressTooLong: string;
  contactPartRequired: string;
  contactNameTooLong: string;
  relationshipTooLong: string;
};

/** Compares as text, as clinic dates must never go through `Date`, which could shift the day. */
function earliestBirthDate(today: string): string {
  const year = Number(today.slice(0, 4)) - 130;
  return `${String(year).padStart(4, "0")}${today.slice(4)}`;
}

/**
 * Quick feedback only: the API's answer always wins. `today` is the clinic's, from the server, as the
 * browser's may differ.
 */
export function patientFormSchema(text: PatientFormText, today: string) {
  return z.object({
    full_name: z
      .string()
      .trim()
      .min(1, text.nameRequired)
      .max(255, text.nameTooLong),
    date_of_birth: z.string().superRefine((value, context) => {
      if (value === "") {
        context.addIssue({ code: "custom", message: text.dateRequired });
      } else if (value > today || value < earliestBirthDate(today)) {
        context.addIssue({ code: "custom", message: text.dateRange });
      }
    }),
    sex: z.enum(SEXES, { error: text.sexRequired }),
    phone: z
      .string()
      .transform(normalizePhone)
      .refine((value) => PHONE.test(value), text.phoneRule),
    national_id: z
      .string()
      .transform(normalizeNationalId)
      .refine(
        (value) => value === "" || NATIONAL_ID.test(value),
        text.nationalIdRule,
      ),
    address: z.string().trim().max(500, text.addressTooLong),
    // The parts can't fail alone, so this refinement always runs, and can speak for all three.
    emergency_contact: z
      .object({
        name: z.string().trim(),
        relationship: z.string().trim(),
        phone: z.string().transform(normalizePhone),
      })
      .superRefine(({ name, relationship, phone }, context) => {
        if (name === "" && relationship === "" && phone === "") return;

        const problem = (part: string, message: string) =>
          context.addIssue({ code: "custom", path: [part], message });

        if (name === "") problem("name", text.contactPartRequired);
        else if (name.length > 255) problem("name", text.contactNameTooLong);

        if (relationship === "") {
          problem("relationship", text.contactPartRequired);
        } else if (relationship.length > 50) {
          problem("relationship", text.relationshipTooLong);
        }

        if (phone === "") problem("phone", text.contactPartRequired);
        else if (!PHONE.test(phone)) problem("phone", text.phoneRule);
      }),
  });
}

export type PatientFormInput = z.input<ReturnType<typeof patientFormSchema>>;
export type PatientFormValues = z.output<ReturnType<typeof patientFormSchema>>;
