import {
  type ApiResult,
  NO_RESPONSE,
  readApiResult,
} from "@/lib/api/api-error";
import type { SignInValues } from "../schemas/sign-in";

export async function signIn(
  values: SignInValues,
  locale: string,
): Promise<ApiResult<unknown>> {
  let response: Response;
  try {
    response = await fetch("/api/auth/sign-in", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Language": locale,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(values),
    });
  } catch {
    return { ok: false, error: NO_RESPONSE };
  }

  return readApiResult(response);
}
