import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { signInToBackend } from "@/features/auth/api/backend-sign-in";
import { callBackend } from "@/lib/api/server-api";
import { isSameOrigin } from "@/lib/auth/origin-check";
import { readSessionIdentity, saveSession } from "@/lib/auth/session";
import { supportedLocale } from "@/lib/i18n/request-locale";
import { routing } from "@/lib/i18n/routing";

const NO_STORE = { "Cache-Control": "no-store" };

const unlockSchema = z.object({
  password: z.string().min(1),
  /** The person the locked page was opened for, which the cookie must still name. */
  userId: z.number().int().positive(),
});

const reply = (body: unknown, status: number) =>
  Response.json(body, { status, headers: NO_STORE });

/**
 * Opens a locked page with a fresh sign-in (ADR 0020). The email is the one sealed at sign-in, never the browser's, and
 * the page says whose it is: if someone else has signed in since, in another tab, their password can't open it. The body
 * is never logged.
 */
export async function POST(request: Request) {
  const locale = supportedLocale(request.headers.get("accept-language"));
  const translationLocale = locale ?? routing.defaultLocale;
  const errors = await getTranslations({
    locale: translationLocale,
    namespace: "auth.errors",
  });

  if (!isSameOrigin(request.headers)) {
    return reply({ message: errors("refused") }, 403);
  }

  const typed = unlockSchema.safeParse(await request.json().catch(() => null));
  if (!typed.success) {
    const message = errors("passwordRequired");
    return reply({ message, errors: { password: [message] } }, 422);
  }

  const lock = await getTranslations({
    locale: translationLocale,
    namespace: "auth.lock",
  });

  const sealed = await readSessionIdentity();
  if (sealed?.userId !== typed.data.userId) {
    return reply({ message: lock("cannotUnlock") }, 409);
  }

  const result = await signInToBackend(
    { email: sealed.email, password: typed.data.password },
    locale,
  );

  // Wrong password, deactivated, or throttled: the backend's own message, and nothing changes.
  if (result.kind === "refused") return reply(result.body, 422);
  if (result.kind === "failed")
    return reply({ message: errors("general") }, 502);

  const { token, user } = result;

  // The sealed email now belongs to someone else. Their new token must not outlive this answer.
  if (user.id !== sealed.userId) {
    await callBackend("auth/sign-out", { method: "POST", locale, token });
    return reply({ message: lock("otherAccount") }, 403);
  }

  // One live token per person: the old one may already have expired, which is fine.
  if (sealed.token) {
    await callBackend("auth/sign-out", {
      method: "POST",
      locale,
      token: sealed.token,
    });
  }
  await saveSession(token, { id: user.id, email: user.email });

  return reply({ data: user }, 200);
}
