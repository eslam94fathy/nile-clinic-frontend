import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/states/loading-state";
import { ScreenGate } from "@/features/auth/public-server";
import { readCharges } from "@/features/billing/api/charges-server";
import { ChargeList } from "@/features/billing/components/charge-list";
import { readChargeFilters } from "@/features/billing/read-charge-filters";
import { readAllDoctors } from "@/features/doctors/api/doctors-server";
import { PatientFilter } from "@/features/patients/public";
import { firstParam } from "@/lib/api/read-resource";
import { getEnv } from "@/lib/config/env";
import { clinicToday } from "@/lib/format/clinic-today";
import { ScopedMessages } from "@/lib/i18n/scoped-messages";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function Charges({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: "charges" });
  const patientId = firstParam(query.patient_id);
  const filters = readChargeFilters(
    {
      from: firstParam(query.from),
      to: firstParam(query.to),
      patient_id: patientId,
      doctor_id: firstParam(query.doctor_id),
      status: firstParam(query.status),
      page: firstParam(query.page),
    },
    clinicToday(getEnv().CLINIC_TIMEZONE),
  );
  const [result, doctors] = await Promise.all([
    // A range the API would refuse isn't sent (research R9), nor a patient that can't be one.
    filters.rangeProblem || filters.patientProblem
      ? Promise.resolve(null)
      : readCharges(locale, filters),
    readAllDoctors(locale),
  ]);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <ScopedMessages locale={locale} namespaces={["patients", "auth"]}>
        <PatientFilter
          key={patientId ?? "none"}
          heading={t("patientFilterHeading")}
          {...(patientId ? { value: patientId } : {})}
        />
      </ScopedMessages>
      <ChargeList
        result={result}
        filters={filters}
        doctors={
          doctors.ok
            ? doctors.data.map(({ id, name, is_active }) => ({
                id,
                name,
                is_active,
              }))
            : null
        }
      />
    </>
  );
}

export default async function ChargesPage({
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
      <ScreenGate locale={locale} path="charges">
        <Charges locale={locale} searchParams={searchParams} />
      </ScreenGate>
    </Suspense>
  );
}
