import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Notices } from "@/components/shared/notices";
import { ThemeScript } from "@/components/shared/theme/theme-script";
import { ThemeSync } from "@/components/shared/theme/theme-sync";
import { DirectionProvider } from "@/components/ui/direction";
import { getDirection } from "@/lib/i18n/direction";
import { routing } from "@/lib/i18n/routing";
import { arabic, latin } from "./fonts";
import "../globals.css";

type LayoutParams = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    title: t("title"),
    description: t("description"),
    robots: { index: false, follow: false },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutParams & { children: ReactNode }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);
  const { brand, error, language, shared } = await getMessages({ locale });
  const direction = getDirection(locale);

  return (
    // The inline script sets `data-theme` before React hydrates, which is the expected difference.
    <html
      lang={locale}
      dir={direction}
      className={`${latin.variable} ${arabic.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh">
        <ThemeSync />
        <DirectionProvider dir={direction}>
          {/* Client Components get their text as props, except error pages and shared components. */}
          <NextIntlClientProvider
            locale={locale}
            messages={{ brand, error, language, shared }}
          >
            {children}
            <Notices />
          </NextIntlClientProvider>
        </DirectionProvider>
      </body>
    </html>
  );
}
