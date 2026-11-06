import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/states/loading-state";
import { ApiFailureState, ScreenGate } from "@/features/auth/public-server";
import { readFees } from "@/features/fees/api/fees-server";
import { FeeList } from "@/features/fees/components/fee-list";
import { firstParam } from "@/lib/api/read-resource";
import { getEnv } from "@/lib/config/env";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function Fees({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: SearchParams;
}) {
  const t = await getTranslations({ locale, namespace: "fees" });
  const result = await readFees(locale, firstParam((await searchParams).page));

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      {result.ok ? (
        <FeeList
          rows={result.data.data}
          meta={result.data.meta}
          timeZone={getEnv().CLINIC_TIMEZONE}
        />
      ) : (
        <ApiFailureState error={result.error} />
      )}
    </>
  );
}

export default async function FeesPage({
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
      <ScreenGate locale={locale} path="fees">
        <Fees locale={locale} searchParams={searchParams} />
      </ScreenGate>
    </Suspense>
  );
}
