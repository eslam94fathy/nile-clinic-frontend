import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/states/loading-state";
import { Button } from "@/components/ui/button";
import { ScreenGate } from "@/features/auth/public-server";
import { PatientSearch } from "@/features/patients/components/patient-search";
import { Link } from "@/lib/i18n/navigation";
import { ScopedMessages } from "@/lib/i18n/scoped-messages";

async function Patients({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "patients" });

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button asChild>
            <Link href="/patients/new" prefetch={false}>
              {t("register")}
            </Link>
          </Button>
        }
      />
      <ScopedMessages locale={locale} namespaces={["patients", "auth"]}>
        <PatientSearch />
      </ScopedMessages>
    </>
  );
}

export default async function PatientsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<LoadingState />}>
      <ScreenGate locale={locale} path="patients">
        <Patients locale={locale} />
      </ScreenGate>
    </Suspense>
  );
}
