import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/states/loading-state";
import { BookingForm } from "@/features/appointments/components/booking-form";
import { ApiFailureState, ScreenGate } from "@/features/auth/public-server";
import { readSpecialties } from "@/features/doctors/api/specialties-server";
import { readPositiveId } from "@/lib/api/read-positive-id";
import { firstParam } from "@/lib/api/read-resource";
import { getEnv } from "@/lib/config/env";
import { clinicToday } from "@/lib/format/clinic-today";
import { ScopedMessages } from "@/lib/i18n/scoped-messages";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function Booking({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const t = await getTranslations({
    locale,
    namespace: "appointments.booking",
  });
  const raw = firstParam(query.patient_id);
  const carried = raw === undefined ? null : readPositiveId(raw);
  const specialties = await readSpecialties(locale);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      {specialties.ok ? (
        <ScopedMessages
          locale={locale}
          namespaces={[
            "appointments",
            "patients",
            "doctors",
            "scheduling",
            "auth",
          ]}
        >
          <BookingForm
            key={raw ?? "none"}
            today={clinicToday(getEnv().CLINIC_TIMEZONE)}
            specialties={specialties.data.data}
            carriedPatient={carried}
            carriedInvalid={raw !== undefined && carried === null}
          />
        </ScopedMessages>
      ) : (
        <ApiFailureState error={specialties.error} />
      )}
    </>
  );
}

export default async function BookAppointmentPage({
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
      <ScreenGate locale={locale} path="appointments">
        <Booking locale={locale} searchParams={searchParams} />
      </ScreenGate>
    </Suspense>
  );
}
