import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/states/loading-state";
import { ApiFailureState, ScreenGate } from "@/features/auth/public-server";
import { readSpecialties } from "@/features/doctors/api/specialties-server";
import { SpecialtyCatalog } from "@/features/doctors/components/specialty-catalog";
import { ScopedMessages } from "@/lib/i18n/scoped-messages";

async function Catalog({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "specialties" });
  const result = await readSpecialties(locale);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      {result.ok ? (
        <ScopedMessages locale={locale} namespaces={["specialties"]}>
          <SpecialtyCatalog specialties={result.data.data} />
        </ScopedMessages>
      ) : (
        <ApiFailureState error={result.error} />
      )}
    </>
  );
}

export default async function SpecialtiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<LoadingState />}>
      <ScreenGate locale={locale} path="specialties">
        <Catalog locale={locale} />
      </ScreenGate>
    </Suspense>
  );
}
