import type { ApiResult } from "@/lib/api/api-error";
import { postAuth } from "./post-auth";

/**
 * The password, and whose page this is: the route signs in with the email sealed at sign-in, and refuses if the cookie
 * now names someone else (ADR 0020).
 */
export function unlock(
  password: string,
  userId: number,
  locale: string,
): Promise<ApiResult<unknown>> {
  return postAuth("unlock", { password, userId }, locale);
}
