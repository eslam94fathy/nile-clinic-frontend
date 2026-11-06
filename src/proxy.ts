import { hasLocale } from "next-intl";
import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "@/lib/i18n/routing";

const handleLocalizedRequest = createMiddleware(routing);

// See docs/decisions/0007-design-system-foundation.md. The page has a second gate, for its content.
const PREVIEW_SEGMENT = "design-preview";

// The address can be percent-encoded, so `/ar/design%2Dpreview` is the same page.
function isPreviewSegment(segment: string | undefined): boolean {
  if (!segment) return false;
  try {
    return decodeURIComponent(segment) === PREVIEW_SEGMENT;
  } catch {
    return false;
  }
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Never re-create the request here: in production that made localized pages return 404
  // intermittently (research R2).
  const [, first, second] = pathname.split("/");
  if (hasLocale(routing.locales, first)) {
    if (
      isPreviewSegment(second) &&
      process.env.DESIGN_PREVIEW_ENABLED !== "true"
    ) {
      const unknown = request.nextUrl.clone();
      unknown.pathname = `/${first}/__unknown`;
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
