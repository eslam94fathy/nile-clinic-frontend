import { hasLocale } from "next-intl";
import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { isSignedInSegment } from "@/lib/auth/app-routes";
import { safeReturnAddress } from "@/lib/auth/return-address";
import { SESSION_COOKIE } from "@/lib/auth/session-cookie";
import { routing } from "@/lib/i18n/routing";

const handleLocalizedRequest = createMiddleware(routing);

const SIGN_IN_SEGMENT = "sign-in";
const PUBLIC_NOT_FOUND_SEGMENT = "address-not-found";
// See docs/decisions/0007-design-system-foundation.md. The page has a second gate, for its content.
const PREVIEW_SEGMENT = "design-preview";

// The address can be percent-encoded, so `/ar/design%2Dpreview` is the same page.
function decodeSegment(segment: string | undefined): string {
  if (!segment) return "";
  try {
    return decodeURIComponent(segment);
  } catch {
    return "";
  }
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Never re-create the request here: in production that made localized pages return 404
  // intermittently (research R2).
  const [, first, rawSecond, ...rest] = pathname.split("/");
  if (hasLocale(routing.locales, first)) {
    // Only whether the cookie is present: an early redirect, and never a security decision. The API decides.
    const hasSession = request.cookies.has(SESSION_COOKIE);

    if (!rawSecond) {
      const target = request.nextUrl.clone();
      target.pathname = `/${first}/${hasSession ? "dashboard" : SIGN_IN_SEGMENT}`;
      return NextResponse.redirect(target);
    }

    const second = decodeSegment(rawSecond);
    const isPreview = second === PREVIEW_SEGMENT;
    const previewEnabled = process.env.DESIGN_PREVIEW_ENABLED === "true";

    // The whole address: `/en/sign-in/x` isn't the sign-in page, and only the signed-in catch-all matches it.
    const isPublicPage =
      rest.length === 0 &&
      (second === SIGN_IN_SEGMENT || second === PUBLIC_NOT_FOUND_SEGMENT);

    if (isPublicPage || (isPreview && previewEnabled && rest.length === 0)) {
      return handleLocalizedRequest(request);
    }

    if (!hasSession && isSignedInSegment(second)) {
      const target = request.nextUrl.clone();
      target.pathname = `/${first}/${SIGN_IN_SEGMENT}`;
      target.search = "";
      const returnTo = safeReturnAddress(pathname);
      if (returnTo) target.searchParams.set("return", returnTo);
      return NextResponse.redirect(target);
    }

    if (!hasSession || (isPreview && !previewEnabled)) {
      // With a session, `__unknown` reaches the framed not-found state, as any unknown address does.
      const unknown = request.nextUrl.clone();
      unknown.pathname = `/${first}/${hasSession ? "__unknown" : PUBLIC_NOT_FOUND_SEGMENT}`;
      unknown.search = "";
      return NextResponse.rewrite(unknown);
    }

    return handleLocalizedRequest(request);
  }

  const saved = request.cookies.get("NEXT_LOCALE")?.value;
  const locale = hasLocale(routing.locales, saved)
    ? saved
    : routing.defaultLocale;

  const target = request.nextUrl.clone();
  target.pathname = pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;
  return NextResponse.redirect(target);
}

export const config = {
  matcher: "/((?!(?:api|_next|_vercel)(?:/|$)|.*\\..*).*)",
};
