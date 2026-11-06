import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoadingState } from "@/components/shared/states/loading-state";
import { Placeholder } from "@/features/app-shell/components/placeholder";
import { ScreenGate } from "@/features/auth/public-server";
import { findRoute } from "@/lib/auth/app-routes";

type Params = Promise<{ locale: string; section: string[] }>;

async function Section({ params }: { params: Params }) {
  const { locale, section } = await params;
  const route = findRoute(section.join("/"));
  if (!route || route.built) notFound();

  return (
    <ScreenGate locale={locale} path={route.path}>
      <Placeholder labelKey={route.labelKey} />
    </ScreenGate>
  );
}

/**
 * Every address under a language with no page of its own. A navigation entry not built yet shows a
 * placeholder, and anything else is the framed not-found state. A later phase's real folder takes priority.
 */
export default async function SectionPage({ params }: { params: Params }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<LoadingState />}>
      <Section params={params} />
    </Suspense>
  );
}
