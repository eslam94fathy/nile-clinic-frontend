import type { ApiResult } from "@/lib/api/api-error";
import { browserApi } from "@/lib/api/browser-api";
import { checkResult, toQuery } from "@/lib/api/check-result";
import { type PageMeta, pageSchema } from "@/lib/api/pagination";
import {
  type DoctorCreateBody,
  type DoctorUpdateBody,
  doctorSummarySchema,
} from "../schemas/doctor";
import type { DoctorSummary } from "../types";

export type ActiveDoctorTerms = { name?: string; specialty_id?: string };
export type ActiveDoctorPage = { data: DoctorSummary[]; meta: PageMeta };

const listSchema = pageSchema(doctorSummarySchema);

/** The API does the name matching, including Arabic spellings, so none is done here. */
export async function searchActiveDoctors(
  terms: ActiveDoctorTerms,
  page: number,
  locale: string,
): Promise<ApiResult<ActiveDoctorPage>> {
  const query = toQuery({
    ...terms,
    is_active: 1,
    page: page > 1 ? page : undefined,
  });
  return checkResult(
    await browserApi(`doctors${query}`, { locale }),
    listSchema,
  );
}

export function createDoctor(
  body: DoctorCreateBody,
  locale: string,
): Promise<ApiResult<unknown>> {
  return browserApi("doctors", { method: "POST", json: body, locale });
}

export function updateDoctor(
  id: number,
  body: DoctorUpdateBody,
  locale: string,
): Promise<ApiResult<unknown>> {
  return browserApi(`doctors/${id}`, { method: "PATCH", json: body, locale });
}
