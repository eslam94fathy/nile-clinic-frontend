import type { ApiResult } from "@/lib/api/api-error";
import { browserApi } from "@/lib/api/browser-api";
import type { TimeOffBody } from "../schemas/schedule";

export function recordTimeOff(
  doctorId: number,
  body: TimeOffBody,
  locale: string,
): Promise<ApiResult<unknown>> {
  return browserApi(`doctors/${doctorId}/time-off`, {
    method: "POST",
    json: body,
    locale,
  });
}

export function removeTimeOff(
  doctorId: number,
  timeOffId: number,
  locale: string,
): Promise<ApiResult<unknown>> {
  return browserApi(`doctors/${doctorId}/time-off/${timeOffId}`, {
    method: "DELETE",
    locale,
  });
}
