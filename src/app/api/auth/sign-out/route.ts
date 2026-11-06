import { getTranslations } from "next-intl/server";
import { callBackend } from "@/lib/api/server-api";
import { isSameOrigin } from "@/lib/auth/origin-check";
import { destroySession, readSessionToken } from "@/lib/auth/session";
import { supportedLocale } from "@/lib/i18n/request-locale";
import { routing } from "@/lib/i18n/routing";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Always clears the cookie, whatever the API answers. If that call fails, the token stays valid until its
 * idle limit, but nothing can present it, as the only copy was in the cookie.
 */
export async function POST(request: Request) {
  const locale = supportedLocale(request.headers.get("accept-language"));

  if (!isSameOrigin(request.headers)) {
    const t = await getTranslations({
      locale: locale ?? routing.defaultLocale,
      namespace: "auth.errors",
    });
    return Response.json(
      { message: t("refused") },
      { status: 403, headers: NO_STORE },
    );
  }

  const token = await readSessionToken();
  if (token) {
    await callBackend("auth/sign-out", { method: "POST", locale, token });
  }
  await destroySession();

  return new Response(null, { status: 204, headers: NO_STORE });
}
