import type { z } from "zod";
import type { ApiResult } from "@/lib/api/api-error";
import { browserApi } from "@/lib/api/browser-api";
import { itemSchema, pageSchema } from "@/lib/api/pagination";
import { patientSchema, patientSummarySchema } from "../schemas/patient";
import type {
  Patient,
  PatientChanges,
  PatientInput,
  PatientSearchTerms,
} from "../types";

// There is deliberately no server read of a patient. A server read of a record writes a false audit entry
// after a refresh and the back button, and search terms can't reach the server without entering the
// address (ADR 0012).

const listSchema = pageSchema(patientSummarySchema);
const recordSchema = itemSchema(patientSchema);

export type PatientPage = z.output<typeof listSchema>;

function checked<Schema extends z.ZodType>(
  result: ApiResult<unknown>,
  schema: Schema,
): ApiResult<z.output<Schema>> {
  if (!result.ok) return result;

  const body = schema.safeParse(result.data);
  return body.success
    ? { ok: true, status: result.status, data: body.data }
    : { ok: false, error: { status: 0, fieldErrors: {} } };
}

function unwrapped(result: ApiResult<unknown>): ApiResult<Patient> {
  const body = checked(result, recordSchema);
  return body.ok ? { ...body, data: body.data.data } : body;
}

/** Sending no term at all would list every patient, which callers must never do (FR-003). */
export async function searchPatients(
  terms: PatientSearchTerms,
  page: number,
  locale: string,
): Promise<ApiResult<PatientPage>> {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(terms)) {
    if (value !== "") query.set(name, value);
  }
  if (page > 1) query.set("page", String(page));

  return checked(
    await browserApi(`patients?${query.toString()}`, { locale }),
    listSchema,
  );
}

export async function findByPhone(
  phone: string,
  locale: string,
): Promise<ApiResult<PatientPage>> {
  const query = new URLSearchParams({ phone, per_page: "10" });
  return checked(
    await browserApi(`patients?${query.toString()}`, { locale }),
    listSchema,
  );
}

/** Each successful call writes a permanent `patient.opened` entry. Only ever call it for a person's action. */
export async function readPatient(
  id: number,
  locale: string,
): Promise<ApiResult<Patient>> {
  return unwrapped(await browserApi(`patients/${id}`, { locale }));
}

export async function registerPatient(
  body: PatientInput,
  locale: string,
): Promise<ApiResult<Patient>> {
  return unwrapped(
    await browserApi("patients", { method: "POST", json: body, locale }),
  );
}

export async function updatePatient(
  id: number,
  changes: PatientChanges,
  locale: string,
): Promise<ApiResult<Patient>> {
  return unwrapped(
    await browserApi(`patients/${id}`, {
      method: "PATCH",
      json: changes,
      locale,
    }),
  );
}
