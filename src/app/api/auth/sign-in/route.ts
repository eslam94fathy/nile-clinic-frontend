import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { signInToBackend } from "@/features/auth/api/backend-sign-in";
import { isSameOrigin } from "@/lib/auth/origin-check";
import { saveSession } from "@/lib/auth/session";
import { supportedLocale } from "@/lib/i18n/request-locale";
import { routing } from "@/lib/i18n/routing";

const NO_STORE = { "Cache-Control": "no-store" };

const credentialsSchema = z.object({
  email: z.string(),
  password: z.string(),
});

/**
 * The only code that sees the raw token. It seals the token into the cookie, and the browser receives
 * only the user. The body is never logged.
 */
export async function POST(request: Request) {
  const locale = supportedLocale(request.headers.get("accept-language"));
  const t = await getTranslations({
    locale: locale ?? routing.defaultLocale,
    namespace: "auth.errors",
  });

  // Also refused from other sites, which could otherwise sign someone into a different account.
  if (!isSameOrigin(request.headers)) {
    return Response.json(
      { message: t("refused") },
      { status: 403, headers: NO_STORE },
    );
  }

  const credentials = credentialsSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!credentials.success) {
    const message = t("emailAndPasswordRequired");
    return Response.json(
      { message, errors: { email: [message] } },
      { status: 422, headers: NO_STORE },
    );
  }

  const result = await signInToBackend(credentials.data, locale);

  if (result.kind === "signed-in") {
    const { token, user } = result;
    // Who signed in, so that a locked page can only ever sign this account in again (ADR 0020).
    await saveSession(token, { id: user.id, email: user.email });
    return Response.json({ data: user }, { headers: NO_STORE });
  }

  if (result.kind === "refused") {
    return Response.json(result.body, { status: 422, headers: NO_STORE });
  }

  return Response.json(
    { message: t("general") },
    { status: 502, headers: NO_STORE },
  );
}
