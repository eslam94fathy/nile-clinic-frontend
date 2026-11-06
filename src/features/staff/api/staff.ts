import type { ApiResult } from "@/lib/api/api-error";
import { browserApi } from "@/lib/api/browser-api";
import type {
  PasswordValues,
  StaffCreateValues,
  StaffEditValues,
} from "../schemas/staff";

export function createStaffMember(
  values: StaffCreateValues,
  locale: string,
): Promise<ApiResult<unknown>> {
  return browserApi("staff", { method: "POST", json: values, locale });
}

export function updateStaffMember(
  id: number,
  changes: Partial<StaffEditValues>,
  locale: string,
): Promise<ApiResult<unknown>> {
  return browserApi(`staff/${id}`, { method: "PATCH", json: changes, locale });
}

export function setStaffActive(
  id: number,
  active: boolean,
  locale: string,
): Promise<ApiResult<unknown>> {
  const action = active ? "reactivate" : "deactivate";
  return browserApi(`staff/${id}/${action}`, { method: "POST", locale });
}

export function setStaffPassword(
  id: number,
  values: PasswordValues,
  locale: string,
): Promise<ApiResult<unknown>> {
  return browserApi(`staff/${id}/password`, {
    method: "PUT",
    json: values,
    locale,
  });
}
