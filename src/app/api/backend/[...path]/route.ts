import { getTranslations } from "next-intl/server";
import type { NextRequest } from "next/server";
import { checkBackendPath } from "@/lib/api/backend-path";
import { callBackend } from "@/lib/api/server-api";
import { stripPageLinks } from "@/lib/api/strip-page-links";
import { isSameOrigin, isStateChanging } from "@/lib/auth/origin-check";
import { readSessionToken } from "@/lib/auth/session";
import { supportedLocale } from "@/lib/i18n/request-locale";
import { routing } from "@/lib/i18n/routing";

const PREFIX = "/api/backend/";
const NO_STORE = { "Cache-Control": "no-store" };
const JSON_TYPE = /^application\/(?:[\w.+-]+\+)?json\b/i;

async function forward(request: NextRequest): Promise<Response> {
  const locale = supportedLocale(request.headers.get("accept-language"));
  const t = await getTranslations({
    locale: locale ?? routing.defaultLocale,
    namespace: "auth.errors",
  });
  const refuse = (status: number, message: string) =>
    Response.json({ message }, { status, headers: NO_STORE });

  // The raw path, because a checked segment must be exactly what's sent on.
  const path = checkBackendPath(request.nextUrl.pathname.slice(PREFIX.length));
  if (path === null) return refuse(404, t("general"));

  if (isStateChanging(request.method) && !isSameOrigin(request.headers)) {
    return refuse(403, t("refused"));
  }

  const token = await readSessionToken();
  if (!token) return refuse(401, t("noSession"));

  // A link opened from elsewhere carries the cookie, but never asks for JSON. Without this, a link to an
  // audited read would write a false "opened" entry against whoever clicked it (ADR 0005).
  if (!request.headers.get("accept")?.includes("application/json")) {
    return refuse(406, t("general"));
  }

  const hasBody = isStateChanging(request.method);
  const response = await callBackend(`${path}${request.nextUrl.search}`, {
    method: request.method,
    locale,
    token,
    contentType: hasBody ? request.headers.get("content-type") : null,
    body: hasBody ? await request.arrayBuffer() : null,
  });

  // A redirect means this isn't the API. Its address must not reach the browser.
  if (!response || (response.status >= 300 && response.status < 400)) {
    return refuse(502, t("general"));
  }

  if (response.status === 204) {
    return new Response(null, { status: 204, headers: NO_STORE });
  }

  // The API always sends JSON. Anything else came from something in front of it, such as an nginx error
  // page, which can show private addresses and versions. The timeout also covers reading the body.
  const contentType = response.headers.get("content-type");
  const body: unknown =
    contentType && JSON_TYPE.test(contentType)
      ? await response.json().catch(() => undefined)
      : undefined;
  if (body === undefined) return refuse(502, t("general"));

  return Response.json(stripPageLinks(body), {
    status: response.status,
    headers: NO_STORE,
  });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
