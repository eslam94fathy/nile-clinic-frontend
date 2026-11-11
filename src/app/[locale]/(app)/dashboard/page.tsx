import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { LiveQueryProvider } from "@/components/shared/live/live-query-provider";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/states/loading-state";
import { UserText } from "@/components/shared/values/user-text";
import { getCurrentUser, ScreenGate } from "@/features/auth/public-server";
import { RoleDashboard } from "@/features/dashboard/components/role-dashboard";
import { getEnv } from "@/lib/config/env";
import { clinicToday } from "@/lib/format/clinic-today";
import { ScopedMessages } from "@/lib/i18n/scoped-messages";

async function Dashboard({ locale }: { locale: string }) {
  const current = await getCurrentUser(locale);
  // The gate has already handled these, and shares this answer.
  if (current.kind !== "signed-in") return null;

  const t = await getTranslations({ locale });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t.rich("shell.welcomeHeading", {
          name: () => <UserText>{current.user.name}</UserText>,
        })}
        description={t("shell.welcomeDescription", {
          role: t(`roles.${current.user.role}`),
        })}
      />
      {/* Panels read in the browser, as the queue's lists do, and none of their reads is audited (ADR 0019). */}
      {/* Reports' text only where its values are shown: the administrator's dashboard. */}
      <ScopedMessages
        locale={locale}
        namespaces={
          current.user.role === "administrator"
            ? ["dashboard", "reports"]
            : ["dashboard"]
        }
      >
        <LiveQueryProvider>
          <RoleDashboard
            role={current.user.role}
            timeZone={getEnv().CLINIC_TIMEZONE}
            today={clinicToday(getEnv().CLINIC_TIMEZONE)}
          />
        </LiveQueryProvider>
      </ScopedMessages>
    </div>
  );
}

/** The signed-in role's dashboard, composed from lists the role already reads elsewhere (Phase 12). */
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
        <Dashboard locale={locale} />
      </ScreenGate>
    </Suspense>
  );
}
