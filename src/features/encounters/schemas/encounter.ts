import { z } from "zod";
import { pageSchema } from "@/lib/api/pagination";
import {
  type Addendum,
  type Encounter,
  type EncounterHistoryItem,
  RECORD_STATUSES,
  type Visit,
} from "../types";

const patientSummary = z.object({
  id: z.number(),
  full_name: z.string(),
  sex: z.enum(["male", "female"]),
  date_of_birth: z.string(),
});

export const visitSchema = z.object({
  id: z.number(),
  date: z.string(),
  walk_in: z.boolean(),
  arrived_at: z.string(),
  called_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  record_status: z.enum(RECORD_STATUSES),
  encounter_id: z.number().nullable(),
  patient: patientSummary,
}) satisfies z.ZodType<Visit>;

export const addendumSchema = z.object({
  id: z.number(),
  text: z.string(),
  created_at: z.string(),
}) satisfies z.ZodType<Addendum>;

const prescriptionLine = z.object({
  medication: z.string(),
  dosage: z.string().nullable(),
  frequency: z.string().nullable(),
  duration: z.string().nullable(),
  instructions: z.string().nullable(),
});

export const encounterSchema = z.object({
  id: z.number(),
  visit_id: z.number(),
  status: z.enum(["draft", "finalized"]),
  date: z.string(),
  doctor: z.object({ id: z.number(), name: z.string(), title: z.string() }),
  patient: patientSummary,
  chief_complaint: z.string().nullable(),
  examination_findings: z.string().nullable(),
  diagnosis: z.string().nullable(),
  treatment_plan: z.string().nullable(),
  prescriptions: z.array(prescriptionLine),
  addenda: z.array(addendumSchema),
  started_at: z.string(),
  last_saved_at: z.string(),
  finalized_at: z.string().nullable(),
}) satisfies z.ZodType<Encounter>;

export const historyItemSchema = z.object({
  id: z.number(),
  date: z.string(),
  doctor: z.object({
    id: z.number(),
    name: z.string(),
    specialties: z.array(
      z.object({
        id: z.number(),
        name_en: z.string(),
        name_ar: z.string(),
        is_active: z.boolean(),
      }),
    ),
  }),
}) satisfies z.ZodType<EncounterHistoryItem>;

export const visitPageSchema = pageSchema(visitSchema);
export const historyPageSchema = pageSchema(historyItemSchema);
