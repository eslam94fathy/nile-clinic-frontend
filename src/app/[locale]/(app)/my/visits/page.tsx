import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/states/loading-state";
import { ScreenGate } from "@/features/auth/public-server";
import { readVisits } from "@/features/encounters/api/visits-server";
import { VisitList } from "@/features/encounters/components/visit-list";
import { readVisitFilters } from "@/features/encounters/read-visit-filters";
import { firstParam } from "@/lib/api/read-resource";
import { getEnv } from "@/lib/config/env";
import { clinicToday } from "@/lib/format/clinic-today";
import { ScopedMessages } from "@/lib/i18n/scoped-messages";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function MyVisits({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const { CLINIC_TIMEZONE: timeZone } = getEnv();
  const filters = readVisitFilters(
    {
      from: firstParam(query.from),
      to: firstParam(query.to),
      record_status: firstParam(query.record_status),
      page: firstParam(query.page),
    },
    clinicToday(timeZone),
  );
  const t = await getTranslations({ locale, namespace: "encounters.visits" });
  const result = await readVisits(locale, filters);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <ScopedMessages locale={locale} namespaces={["encounters", "auth"]}>
        <VisitList result={result} filters={filters} timeZone={timeZone} />
      </ScopedMessages>
    </>
  );
}

export default async function MyVisitsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<LoadingState />}>
      <ScreenGate locale={locale} path="my/visits">
        <MyVisits locale={locale} searchParams={searchParams} />
      </ScreenGate>
    </Suspense>
  );
}
