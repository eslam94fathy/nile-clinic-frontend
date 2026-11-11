import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/states/loading-state";
import { AuditSearch } from "@/features/audit/components/audit-search";
import { ScreenGate } from "@/features/auth/public-server";
import { readAllStaff } from "@/features/staff/api/staff-server";
import { getEnv } from "@/lib/config/env";
import { ScopedMessages } from "@/lib/i18n/scoped-messages";

type Params = Promise<{ locale: string }>;

// The trail itself is never read here: each read writes an entry, so only a person's press in the browser may make
// one (ADR 0018). The staff list isn't audited, so it's read on the server like every other list (ADR 0011).
async function Audit({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "audit" });
  const staff = await readAllStaff(locale);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <ScopedMessages locale={locale} namespaces={["audit", "roles", "auth"]}>
        <AuditSearch
          staff={
            staff.ok
              ? staff.data.map(({ id, name, is_active }) => ({
                  id,
                  name,
                  is_active,
                }))
              : null
          }
          timeZone={getEnv().CLINIC_TIMEZONE}
        />
      </ScopedMessages>
    </>
  );
}

export default async function AuditPage({ params }: { params: Params }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<LoadingState />}>
      <ScreenGate locale={locale} path="audit">
        <Audit locale={locale} />
      </ScreenGate>
    </Suspense>
  );
}
