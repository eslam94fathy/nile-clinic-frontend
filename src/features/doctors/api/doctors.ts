import type { ApiResult } from "@/lib/api/api-error";
import { browserApi } from "@/lib/api/browser-api";
import type { DoctorCreateBody, DoctorUpdateBody } from "../schemas/doctor";

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
