import { endSession } from "@/lib/auth/session-end";
import { type ApiResult, NO_RESPONSE, readApiResult } from "./api-error";

/**
 * Client code's only way to the API, through the same-origin route, which adds the token. Mutations are
 * never retried. On `401`, this ends the session and never settles: the page is leaving, so no caller
 * should flash an error or update the screen in the meantime.
 */
export async function browserApi(
  path: string,
  {
    method = "GET",
    json,
    locale,
  }: { method?: string; json?: unknown; locale: string },
): Promise<ApiResult<unknown>> {
  let response: Response;
  try {
    response = await fetch(`/api/backend/${path}`, {
      method,
      headers: {
        Accept: "application/json",
        "Accept-Language": locale,
        ...(json === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(json === undefined ? {} : { body: JSON.stringify(json) }),
    });
  } catch {
    return { ok: false, error: NO_RESPONSE };
  }

  if (response.status === 401) {
    endSession();
    return new Promise(() => {});
  }

  return readApiResult(response);
}
