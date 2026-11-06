import type { ApiResult } from "@/lib/api/api-error";
import { browserApi } from "@/lib/api/browser-api";
import type { SpecialtyFormValues } from "../schemas/specialty";

export function createSpecialty(
  values: SpecialtyFormValues,
  locale: string,
): Promise<ApiResult<unknown>> {
  return browserApi("specialties", { method: "POST", json: values, locale });
}

export function renameSpecialty(
  id: number,
  changes: Partial<SpecialtyFormValues>,
  locale: string,
): Promise<ApiResult<unknown>> {
  return browserApi(`specialties/${id}`, {
    method: "PATCH",
    json: changes,
    locale,
  });
}

export function setSpecialtyActive(
  id: number,
  active: boolean,
  locale: string,
): Promise<ApiResult<unknown>> {
  const action = active ? "reactivate" : "deactivate";
  return browserApi(`specialties/${id}/${action}`, { method: "POST", locale });
}
