import { endSession } from "@/lib/auth/session-end";
import { type ApiResult, NO_RESPONSE, readApiResult } from "./api-error";

/**
 * Client code's only way to the API, through the same-origin route, which adds the token. Mutations are
 * never retried. On `401`, this ends the session and never settles: the page is leaving, so no caller
 * should flash an error or update the screen in the meantime. `answerSessionEnd` is for a page with text only
 * on screen, which would be lost by leaving: it gets the failure, and leaves when the person chooses (ADR 0014).
 */
export async function browserApi(
  path: string,
  {
    method = "GET",
    json,
    locale,
    answerSessionEnd = false,
  }: {
    method?: string;
    json?: unknown;
    locale: string;
    answerSessionEnd?: boolean;
  },
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

  if (response.status === 401 && !answerSessionEnd) {
    endSession();
    return new Promise(() => {});
  }

  return readApiResult(response);
}
