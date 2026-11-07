import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/states/loading-state";
import { Button } from "@/components/ui/button";
import { readAppointments } from "@/features/appointments/api/appointments-server";
import { AppointmentList } from "@/features/appointments/components/appointment-list";
import { AppointmentPatientFilter } from "@/features/appointments/components/appointment-patient-filter";
import { AppointmentViewLinks } from "@/features/appointments/components/appointment-view-links";
import { resolveRange } from "@/features/appointments/resolve-range";
import { ScreenGate } from "@/features/auth/public-server";
import { readAllDoctors } from "@/features/doctors/api/doctors-server";
import { firstParam } from "@/lib/api/read-resource";
import { getEnv } from "@/lib/config/env";
import { clinicToday } from "@/lib/format/clinic-today";
import { Link } from "@/lib/i18n/navigation";
import { ScopedMessages } from "@/lib/i18n/scoped-messages";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function Appointments({
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
    doctor_id: firstParam(query.doctor_id),
    patient_id: firstParam(query.patient_id),
    status: firstParam(query.status),
    outside_availability: firstParam(query.outside_availability) && "1",
  };
  const t = await getTranslations({ locale, namespace: "appointments" });
  const range = resolveRange(filters, clinicToday(getEnv().CLINIC_TIMEZONE));
  const [appointments, doctors] = await Promise.all([
    readAppointments(locale, {
      ...filters,
      ...range,
      page: firstParam(query.page),
    }),
    readAllDoctors(locale),
  ]);

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button asChild>
            <Link href="/appointments/new" prefetch={false}>
              {t("book")}
            </Link>
          </Button>
        }
      />
      <AppointmentViewLinks filters={filters} />
      <ScopedMessages
        locale={locale}
        namespaces={["appointments", "patients", "auth"]}
      >
        <AppointmentPatientFilter
          key={filters.patient_id ?? "none"}
          {...(filters.patient_id ? { value: filters.patient_id } : {})}
        />
      </ScopedMessages>
      <AppointmentList
        result={appointments}
        filters={filters}
        range={range}
        doctors={doctors.ok ? doctors.data : null}
      />
    </>
  );
}

export default async function AppointmentsPage({
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
        <Appointments locale={locale} searchParams={searchParams} />
      </ScreenGate>
    </Suspense>
  );
}
