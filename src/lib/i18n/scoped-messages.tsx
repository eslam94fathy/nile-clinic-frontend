import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";

type Messages = Awaited<ReturnType<typeof getMessages>>;

/**
 * Gives Client Components below it one feature's text, as a feature's forms have too much to pass as
 * props. A provider replaces its parent's messages, so `shared` and `error` are repeated here. Only what's
 * listed reaches the browser.
 */
export async function ScopedMessages({
  locale,
  namespaces,
  children,
}: {
  locale: string;
  namespaces: readonly (keyof Messages)[];
  children: ReactNode;
}) {
  const messages = await getMessages({ locale });
  const scoped = Object.fromEntries(
    (["brand", "error", "language", "shared", ...namespaces] as const).map(
      (namespace) => [namespace, messages[namespace]],
    ),
  );

  return (
    <NextIntlClientProvider locale={locale} messages={scoped}>
      {children}
    </NextIntlClientProvider>
  );
}
