import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/states/loading-state";
import { ScreenGate } from "@/features/auth/public-server";

async function Register({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "patients" });

  return (
    <PageHeader
      title={t("registerForm.title")}
      description={t("registerForm.description")}
    />
  );
}

export default async function RegisterPatientPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<LoadingState />}>
      <ScreenGate locale={locale} path="patients">
        <Register locale={locale} />
      </ScreenGate>
    </Suspense>
  );
}
