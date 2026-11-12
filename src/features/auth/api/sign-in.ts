import type { ApiResult } from "@/lib/api/api-error";
import type { SignInValues } from "../schemas/sign-in";
import { postAuth } from "./post-auth";

export function signIn(
  values: SignInValues,
  locale: string,
): Promise<ApiResult<unknown>> {
  return postAuth("sign-in", values, locale);
}
