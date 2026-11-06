import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/states/loading-state";
import { UserText } from "@/components/shared/values/user-text";
import { Button } from "@/components/ui/button";
import { ApiFailureState, ScreenGate } from "@/features/auth/public-server";
import { readDoctor } from "@/features/doctors/api/doctors-server";
import { readSpecialties } from "@/features/doctors/api/specialties-server";
import { DoctorForm } from "@/features/doctors/components/doctor-form";
import { readPositiveId } from "@/lib/api/read-positive-id";
import { Link } from "@/lib/i18n/navigation";
import { ScopedMessages } from "@/lib/i18n/scoped-messages";

type Params = Promise<{ locale: string; id: string }>;

async function EditDoctor({ params }: { params: Params }) {
  const { locale, id: rawId } = await params;
  const id = readPositiveId(rawId);
  if (id === null) notFound();

  const t = await getTranslations({ locale, namespace: "doctors" });
  const [doctor, specialties] = await Promise.all([
    readDoctor(locale, id),
    readSpecialties(locale, true),
  ]);
  if (!doctor.ok) return <ApiFailureState error={doctor.error} />;
  if (!specialties.ok) return <ApiFailureState error={specialties.error} />;

  // The active ones, plus any deactivated one this doctor already has, which may be kept.
  const active = specialties.data.data;
  const kept = doctor.data.data.specialties.filter(
    (assigned) => !active.some(({ id: activeId }) => activeId === assigned.id),
  );

  return (
    <>
      <PageHeader
        title={t("editTitle")}
        description={<UserText>{doctor.data.data.name}</UserText>}
        actions={
          <Button variant="outline" asChild>
            <Link href={`/doctors/${id}`} prefetch={false}>
              {t("backToDoctor")}
            </Link>
          </Button>
        }
      />
      <ScopedMessages locale={locale} namespaces={["doctors"]}>
        <DoctorForm
          key={doctor.data.data.updated_at}
          doctor={doctor.data.data}
          specialties={[...active, ...kept]}
        />
      </ScopedMessages>
    </>
  );
}

export default async function EditDoctorPage({ params }: { params: Params }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<LoadingState />}>
      <ScreenGate locale={locale} path="doctors" capability="manageDoctors">
        <EditDoctor params={params} />
      </ScreenGate>
    </Suspense>
  );
}
