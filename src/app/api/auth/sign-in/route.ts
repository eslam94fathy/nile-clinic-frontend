import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { staffMemberSchema } from "@/features/auth/schemas/staff-member";
import { callBackend } from "@/lib/api/server-api";
import { isSameOrigin } from "@/lib/auth/origin-check";
import { saveSession } from "@/lib/auth/session";
import { supportedLocale } from "@/lib/i18n/request-locale";
import { routing } from "@/lib/i18n/routing";

const NO_STORE = { "Cache-Control": "no-store" };

const credentialsSchema = z.object({
  email: z.string(),
  password: z.string(),
});

const signedInSchema = z.object({
  data: z.object({ token: z.string().min(1), user: staffMemberSchema }),
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

  const response = await callBackend("auth/sign-in", {
    method: "POST",
    locale,
    contentType: "application/json",
    body: JSON.stringify(credentials.data),
  });
  const body: unknown = await response?.json().catch(() => null);

  if (response?.status === 200) {
    const signedIn = signedInSchema.safeParse(body);
    if (signedIn.success) {
      await saveSession(signedIn.data.data.token);
      return Response.json(
        { data: signedIn.data.data.user },
        { headers: NO_STORE },
      );
    }
  }

  if (response?.status === 422) {
    return Response.json(body, { status: 422, headers: NO_STORE });
  }

  return Response.json(
    { message: t("general") },
    { status: 502, headers: NO_STORE },
  );
}
