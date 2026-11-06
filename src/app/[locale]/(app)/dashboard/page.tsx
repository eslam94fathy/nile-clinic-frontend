import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/states/loading-state";
import { UserText } from "@/components/shared/values/user-text";
import { getCurrentUser, ScreenGate } from "@/features/auth/public-server";

async function Welcome({ locale }: { locale: string }) {
  const current = await getCurrentUser(locale);
  // The gate has already handled these, and shares this answer.
  if (current.kind !== "signed-in") return null;

  const t = await getTranslations({ locale });
  return (
    <PageHeader
      title={t.rich("shell.welcomeHeading", {
        name: () => <UserText>{current.user.name}</UserText>,
      })}
      description={t("shell.welcomeDescription", {
        role: t(`roles.${current.user.role}`),
      })}
    />
  );
}

/** A simple welcome. Role dashboards come in Phase 12, once what they draw on exists. */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<LoadingState />}>
      <ScreenGate locale={locale} path="dashboard">
        <Welcome locale={locale} />
      </ScreenGate>
    </Suspense>
  );
}
