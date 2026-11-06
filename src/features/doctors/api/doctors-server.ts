import "server-only";
import { cache } from "react";
import { itemSchema, pageSchema } from "@/lib/api/pagination";
import { readResource, toQuery } from "@/lib/api/read-resource";
import { doctorSchema, doctorSummarySchema } from "../schemas/doctor";

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

/** Shared within one render, as a doctor's page reads the profile from more than one place. */
export const readDoctor = cache((locale: string, id: number) =>
  readResource(`doctors/${id}`, locale, itemSchema(doctorSchema)),
);
