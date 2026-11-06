import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";

export const messagesByLocale = { ar, en };

export function renderWithIntl(ui: ReactNode, locale: "ar" | "en" = "en") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={messagesByLocale[locale]}
      timeZone="Africa/Cairo"
    >
      {ui}
    </NextIntlClientProvider>,
  );
}
