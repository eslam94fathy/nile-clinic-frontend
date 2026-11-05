import { hasLocale } from "next-intl";
import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "@/lib/i18n/routing";

const handleLocalizedRequest = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Never re-create the request here: in production that made localized pages return 404
  // intermittently (research R2).
  if (hasLocale(routing.locales, pathname.split("/")[1])) {
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
