import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/states/loading-state";
import { Button } from "@/components/ui/button";
import { ScreenGate } from "@/features/auth/public-server";
import { StaffCreateForm } from "@/features/staff/components/staff-create-form";
import { firstParam } from "@/lib/api/read-resource";
import { Link } from "@/lib/i18n/navigation";
import { ScopedMessages } from "@/lib/i18n/scoped-messages";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function NewAccount({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: SearchParams;
}) {
  const t = await getTranslations({ locale, namespace: "staff" });
  const role = firstParam((await searchParams).role);

  return (
    <>
      <PageHeader
        title={t("createTitle")}
        description={t("createDescription")}
        actions={
          <Button variant="outline" asChild>
            <Link href="/staff" prefetch={false}>
              {t("backToList")}
            </Link>
          </Button>
        }
      />
      <ScopedMessages locale={locale} namespaces={["staff", "roles"]}>
        <StaffCreateForm
          {...(role === "doctor" ? { defaultRole: "doctor" as const } : {})}
        />
      </ScopedMessages>
    </>
  );
}

export default async function NewStaffPage({
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
      <ScreenGate locale={locale} path="staff">
        <NewAccount locale={locale} searchParams={searchParams} />
      </ScreenGate>
    </Suspense>
  );
}
