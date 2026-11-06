import type { Specialty } from "./types";

/** The name for the active language. Both are stored, and neither is ever translated. */
export function specialtyName(specialty: Specialty, locale: string): string {
  return locale === "ar" ? specialty.name_ar : specialty.name_en;
}
