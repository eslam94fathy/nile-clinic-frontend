import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/states/loading-state";
import { Button } from "@/components/ui/button";
import { Can } from "@/features/app-shell/public";
import { ApiFailureState, ScreenGate } from "@/features/auth/public-server";
import { readDoctors } from "@/features/doctors/api/doctors-server";
import { readSpecialties } from "@/features/doctors/api/specialties-server";
import { DoctorList } from "@/features/doctors/components/doctor-list";
import { firstParam } from "@/lib/api/read-resource";
import { Link } from "@/lib/i18n/navigation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function Doctors({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const filters = {
    name: firstParam(query.name),
    specialty_id: firstParam(query.specialty_id),
    is_active: firstParam(query.is_active),
  };
  const t = await getTranslations({ locale, namespace: "doctors" });
  const [doctors, specialties] = await Promise.all([
    readDoctors(locale, { ...filters, page: firstParam(query.page) }),
    readSpecialties(locale),
  ]);

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Can capability="manageDoctors">
            <Button asChild>
              <Link href="/doctors/new" prefetch={false}>
                {t("newDoctor")}
              </Link>
            </Button>
          </Can>
        }
      />
      {!doctors.ok ? (
        <ApiFailureState error={doctors.error} />
      ) : !specialties.ok ? (
        <ApiFailureState error={specialties.error} />
      ) : (
        <DoctorList
          rows={doctors.data.data}
          meta={doctors.data.meta}
          filters={filters}
          specialties={specialties.data.data}
        />
      )}
    </>
  );
}

export default async function DoctorsPage({
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
      <ScreenGate locale={locale} path="doctors">
        <Doctors locale={locale} searchParams={searchParams} />
      </ScreenGate>
    </Suspense>
  );
}
