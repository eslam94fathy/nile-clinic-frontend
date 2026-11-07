import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/states/loading-state";
import { Button } from "@/components/ui/button";
import { ScreenGate } from "@/features/auth/public-server";
import { readAllDoctors } from "@/features/doctors/api/doctors-server";
import { ClinicQueue } from "@/features/queue/components/clinic-queue";
import { LiveQueryProvider } from "@/features/queue/components/live-query-provider";
import { readQueueFilters } from "@/features/queue/read-queue-filters";
import { firstParam } from "@/lib/api/read-resource";
import { getEnv } from "@/lib/config/env";
import { Link } from "@/lib/i18n/navigation";
import { ScopedMessages } from "@/lib/i18n/scoped-messages";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function Queue({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: "queue" });
  const doctors = await readAllDoctors(locale);

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/appointments" prefetch={false}>
                {t("todaysAppointments")}
              </Link>
            </Button>
            <Button asChild>
              <Link href="/queue/walk-in" prefetch={false}>
                {t("addWalkIn")}
              </Link>
            </Button>
          </>
        }
      />
      <ScopedMessages locale={locale} namespaces={["queue", "auth"]}>
        <LiveQueryProvider>
          <ClinicQueue
            filters={readQueueFilters({
              doctor_id: firstParam(query.doctor_id),
              status: firstParam(query.status),
              page: firstParam(query.page),
            })}
            doctors={
              doctors.ok
                ? doctors.data.map(({ id, name, is_active }) => ({
                    id,
                    name,
                    is_active,
                  }))
                : null
            }
            timeZone={getEnv().CLINIC_TIMEZONE}
          />
        </LiveQueryProvider>
      </ScopedMessages>
    </>
  );
}

export default async function QueuePage({
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
      <ScreenGate locale={locale} path="queue">
        <Queue locale={locale} searchParams={searchParams} />
      </ScreenGate>
    </Suspense>
  );
}
