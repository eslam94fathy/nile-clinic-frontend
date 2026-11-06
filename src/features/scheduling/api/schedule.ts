import type { ApiResult } from "@/lib/api/api-error";
import { browserApi } from "@/lib/api/browser-api";
import type { ScheduleFormOutput } from "../schemas/schedule";

export function saveSchedule(
  doctorId: number,
  values: ScheduleFormOutput,
  locale: string,
): Promise<ApiResult<unknown>> {
  return browserApi(`doctors/${doctorId}/schedule`, {
    method: "PUT",
    json: values,
    locale,
  });
}

export function clearSchedule(
  doctorId: number,
  locale: string,
): Promise<ApiResult<unknown>> {
  return browserApi(`doctors/${doctorId}/schedule`, {
    method: "DELETE",
    locale,
  });
}
