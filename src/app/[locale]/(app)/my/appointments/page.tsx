import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/states/loading-state";
import { readOwnAppointments } from "@/features/appointments/api/appointments-server";
import { OwnAppointmentList } from "@/features/appointments/components/own-appointment-list";
import { resolveRange } from "@/features/appointments/resolve-range";
import { ScreenGate } from "@/features/auth/public-server";
import { firstParam } from "@/lib/api/read-resource";
import { getEnv } from "@/lib/config/env";
import { clinicToday } from "@/lib/format/clinic-today";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function MyAppointments({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const filters = {
    from: firstParam(query.from),
    to: firstParam(query.to),
    status: firstParam(query.status),
  };
  const t = await getTranslations({ locale, namespace: "appointments.own" });
  const range = resolveRange(filters, clinicToday(getEnv().CLINIC_TIMEZONE));
  const result = await readOwnAppointments(locale, {
    ...filters,
    ...range,
    page: firstParam(query.page),
  });

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <OwnAppointmentList result={result} filters={filters} range={range} />
    </>
  );
}

export default async function MyAppointmentsPage({
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
      <ScreenGate locale={locale} path="my/appointments">
        <MyAppointments locale={locale} searchParams={searchParams} />
      </ScreenGate>
    </Suspense>
  );
}
