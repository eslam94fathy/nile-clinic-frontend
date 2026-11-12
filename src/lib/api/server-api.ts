import "server-only";
import { headers as requestHeaders } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { readSessionToken } from "@/lib/auth/session";
import { getEnv } from "@/lib/config/env";
import { type ApiResult, NO_RESPONSE, readApiResult } from "./api-error";

const TIMEOUT_MS = 10_000;

type BackendRequest = {
  method?: string;
  /** Goes on the request as `Accept-Language`, when it's a supported locale. */
  locale?: string | null;
  token?: string | null;
  contentType?: string | null;
  body?: BodyInit | null;
};

/**
 * The client's address, exactly as the reverse proxy set it, which must replace rather than append (ADR 0022).
 * The backend uses it only once it trusts this application's address (hazard H2). Read here alone, never in a
 * page or layout, so that nothing outside request-time work reads the request.
 */
async function forwardedFor(): Promise<string | null> {
  try {
    return (await requestHeaders()).get("x-forwarded-for");
  } catch (error) {
    // Next.js's own signals, such as a prerender meeting request data, must reach Next.js (ADR 0006).
    unstable_rethrow(error);
    // No request to read, so nothing to pass on.
    return null;
  }
}

/**
 * The one place the server reaches the API, so that a change such as forwarding the client's address
 * (hazard H2) has one home. Returns null when no answer arrived.
 */
export async function callBackend(
  path: string,
  { method = "GET", locale, token, contentType, body }: BackendRequest = {},
): Promise<Response | null> {
  const headers = new Headers({ Accept: "application/json" });
  if (locale) headers.set("Accept-Language", locale);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (contentType) headers.set("Content-Type", contentType);
  const clientAddress = await forwardedFor();
  if (clientAddress) headers.set("X-Forwarded-For", clientAddress);

  try {
    return await fetch(`${getEnv().BACKEND_API_URL}/${path}`, {
      method,
      headers,
      ...(body ? { body } : {}),
      cache: "no-store",
      // A redirect means this isn't the API, so it must not be followed with the token.
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return null;
  }
}

/**
 * Reads from the API for a page. The first line matters: without it, a link's prefetch runs this on the
 * server, because prefetch shells include cookie-based content (research R3). That would restart the
 * idle timer, and could reach audited reads. Never wrap the result in `use cache` (ADR 0006).
 */
export async function serverApi(
  path: string,
  { locale }: { locale: string },
): Promise<ApiResult<unknown>> {
  await connection();

  const token = await readSessionToken();
  if (!token) return { ok: false, error: { status: 401, fieldErrors: {} } };

  const response = await callBackend(path, { locale, token });
  if (!response) return { ok: false, error: NO_RESPONSE };

  return readApiResult(response);
}
