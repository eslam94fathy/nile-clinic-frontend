import type { ApiResult } from "@/lib/api/api-error";
import { browserApi } from "@/lib/api/browser-api";
import type { FeeFormValues } from "../schemas/fee";

export function setFee(
  doctorId: number,
  values: FeeFormValues,
  locale: string,
): Promise<ApiResult<unknown>> {
  return browserApi(`doctors/${doctorId}/fee`, {
    method: "PUT",
    json: values,
    locale,
  });
}
