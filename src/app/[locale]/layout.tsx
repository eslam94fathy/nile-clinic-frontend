import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { LanguageSwitch } from "@/components/shared/language-switch";
import { getDirection } from "@/lib/i18n/direction";
import { routing } from "@/lib/i18n/routing";
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
  const t = await getTranslations({ locale, namespace: "language" });
  const { error } = await getMessages({ locale });

  return (
    <html lang={locale} dir={getDirection(locale)}>
      <body className="min-h-dvh bg-white text-neutral-900">
        {/* Client Components get their text as props, except error pages, which can't. */}
        <NextIntlClientProvider
          locale={locale}
          messages={error ? { error } : null}
        >
          <header className="flex justify-end p-4">
            <nav aria-label={t("label")}>
              <LanguageSwitch label={t("switch")} />
            </nav>
          </header>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
