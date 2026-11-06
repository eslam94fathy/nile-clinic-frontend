import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/states/loading-state";
import { Button } from "@/components/ui/button";
import { ApiFailureState, ScreenGate } from "@/features/auth/public-server";
import { readStaffList } from "@/features/staff/api/staff-server";
import { StaffList } from "@/features/staff/components/staff-list";
import { firstParam } from "@/lib/api/read-resource";
import { Link } from "@/lib/i18n/navigation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function Staff({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const filters = {
    role: firstParam(query.role),
    is_active: firstParam(query.is_active),
  };
  const t = await getTranslations({ locale, namespace: "staff" });
  const result = await readStaffList(locale, {
    ...filters,
    page: firstParam(query.page),
  });

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button asChild>
            <Link href="/staff/new" prefetch={false}>
              {t("newAccount")}
            </Link>
          </Button>
        }
      />
      {result.ok ? (
        <StaffList
          rows={result.data.data}
          meta={result.data.meta}
          filters={filters}
        />
      ) : (
        <ApiFailureState error={result.error} />
      )}
    </>
  );
}

export default async function StaffPage({
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
        <Staff locale={locale} searchParams={searchParams} />
      </ScreenGate>
    </Suspense>
  );
}
