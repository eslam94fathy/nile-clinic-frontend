import {
  type ApiResult,
  NO_RESPONSE,
  readApiResult,
} from "@/lib/api/api-error";

/** A JSON post to one of this application's own auth routes; no answer at all reads as `NO_RESPONSE`. */
export async function postAuth(
  route: "sign-in" | "unlock",
  body: unknown,
  locale: string,
): Promise<ApiResult<unknown>> {
  let response: Response;
  try {
    response = await fetch(`/api/auth/${route}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Language": locale,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: NO_RESPONSE };
  }

  return readApiResult(response);
}
