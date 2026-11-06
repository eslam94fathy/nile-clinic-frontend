import type { ApiResult } from "@/lib/api/api-error";
import { browserApi } from "@/lib/api/browser-api";
import type { ChangePasswordValues } from "../schemas/change-password";

export function changePassword(
  values: ChangePasswordValues,
  locale: string,
): Promise<ApiResult<unknown>> {
  return browserApi("auth/password", { method: "PUT", json: values, locale });
}
