import "server-only";
import { cache } from "react";
import type { ApiResult } from "@/lib/api/api-error";
import { itemSchema, pageSchema } from "@/lib/api/pagination";
import { readResource, toQuery } from "@/lib/api/read-resource";
import { doctorSchema, doctorSummarySchema } from "../schemas/doctor";
import type { DoctorSummary } from "../types";

export type DoctorFilters = {
  name?: string | undefined;
  specialty_id?: string | undefined;
  is_active?: string | undefined;
  page?: string | undefined;
};

export function readDoctors(locale: string, filters: DoctorFilters) {
  return readResource(
    `doctors${toQuery(filters)}`,
    locale,
    pageSchema(doctorSummarySchema),
  );
}

/** Every doctor, for a filter that must offer them all, including inactive ones. One failed page fails it. */
export async function readAllDoctors(
  locale: string,
): Promise<ApiResult<DoctorSummary[]>> {
  const all: DoctorSummary[] = [];
  for (let page = 1; ; page += 1) {
    const result = await readResource(
      `doctors${toQuery({ per_page: 100, page })}`,
      locale,
      pageSchema(doctorSummarySchema),
    );
    if (!result.ok) return result;

    all.push(...result.data.data);
    if (page >= result.data.meta.last_page) {
      return { ok: true, status: result.status, data: all };
    }
  }
}

/** Shared within one render, as a doctor's page reads the profile from more than one place. */
export const readDoctor = cache((locale: string, id: number) =>
  readResource(`doctors/${id}`, locale, itemSchema(doctorSchema)),
);
