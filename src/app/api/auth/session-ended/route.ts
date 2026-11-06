import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/features/auth/api/current-user";
import { safeReturnAddress } from "@/lib/auth/return-address";
import { destroySession } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/session-cookie";
import { supportedLocale } from "@/lib/i18n/request-locale";
import { routing } from "@/lib/i18n/routing";

function redirectTo(location: string) {
  // Relative, so that this doesn't depend on how a reverse proxy presents the address.
  return new Response(null, {
    status: 303,
    headers: { Location: location, "Cache-Control": "no-store" },
  });
}

/**
 * A Server Component can't clear a cookie, so a session found to have ended comes through here. It asks
 * the API first, so that a link to this address can't sign someone out of a working session.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const locale =
    supportedLocale(searchParams.get("locale")) ?? routing.defaultLocale;

  const current = await getCurrentUser(locale);
  if (current.kind !== "no-session") return redirectTo(`/${locale}/dashboard`);

  await destroySession();

  // With no cookie, no session has ended: this person simply hasn't signed in.
  const query = new URLSearchParams(
    request.cookies.has(SESSION_COOKIE) ? { ended: "1" } : {},
  );
  const returnTo = safeReturnAddress(searchParams.get("return"));
  if (returnTo) query.set("return", returnTo);

  const search = query.size > 0 ? `?${query}` : "";
  return redirectTo(`/${locale}/sign-in${search}`);
}
