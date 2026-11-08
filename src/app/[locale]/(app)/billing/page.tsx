import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { LiveQueryProvider } from "@/components/shared/live/live-query-provider";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/states/loading-state";
import { ScreenGate } from "@/features/auth/public-server";
import { BillingList } from "@/features/billing/components/billing-list";
import { readBillingFilters } from "@/features/billing/read-billing-filters";
import { readAllDoctors } from "@/features/doctors/api/doctors-server";
import { firstParam } from "@/lib/api/read-resource";
import { getEnv } from "@/lib/config/env";
import { clinicToday } from "@/lib/format/clinic-today";
import { ScopedMessages } from "@/lib/i18n/scoped-messages";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function Billing({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: "billing" });
  const timeZone = getEnv().CLINIC_TIMEZONE;
  const doctors = await readAllDoctors(locale);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <ScopedMessages locale={locale} namespaces={["billing", "auth"]}>
        <LiveQueryProvider>
          <BillingList
            filters={readBillingFilters(
              {
                date: firstParam(query.date),
                doctor_id: firstParam(query.doctor_id),
                charge_status: firstParam(query.charge_status),
                page: firstParam(query.page),
              },
              clinicToday(timeZone),
            )}
            doctors={
              doctors.ok
                ? doctors.data.map(({ id, name, is_active }) => ({
                    id,
                    name,
                    is_active,
                  }))
                : null
            }
            timeZone={timeZone}
          />
        </LiveQueryProvider>
      </ScopedMessages>
    </>
  );
}

export default async function BillingPage({
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
      <ScreenGate locale={locale} path="billing">
        <Billing locale={locale} searchParams={searchParams} />
      </ScreenGate>
    </Suspense>
  );
}
