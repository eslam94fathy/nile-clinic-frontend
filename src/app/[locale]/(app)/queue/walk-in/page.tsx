import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/states/loading-state";
import { Button } from "@/components/ui/button";
import { ApiFailureState, ScreenGate } from "@/features/auth/public-server";
import { readSpecialties } from "@/features/doctors/api/specialties-server";
import { WalkInForm } from "@/features/queue/components/walk-in-form";
import { readPositiveId } from "@/lib/api/read-positive-id";
import { firstParam } from "@/lib/api/read-resource";
import { Link } from "@/lib/i18n/navigation";
import { ScopedMessages } from "@/lib/i18n/scoped-messages";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function WalkIn({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: "queue.walkInForm" });
  const raw = firstParam(query.patient_id);
  const carried = raw === undefined ? null : readPositiveId(raw);
  const specialties = await readSpecialties(locale);

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button variant="outline" asChild>
            <Link href="/queue" prefetch={false}>
              {t("back")}
            </Link>
          </Button>
        }
      />
      {specialties.ok ? (
        <ScopedMessages
          locale={locale}
          namespaces={["queue", "patients", "doctors", "auth"]}
        >
          <WalkInForm
            key={raw ?? "none"}
            specialties={specialties.data.data}
            carriedPatient={carried}
            carriedInvalid={raw !== undefined && carried === null}
          />
        </ScopedMessages>
      ) : (
        <ApiFailureState error={specialties.error} />
      )}
    </>
  );
}

export default async function WalkInPage({
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
      <ScreenGate locale={locale} path="queue">
        <WalkIn locale={locale} searchParams={searchParams} />
      </ScreenGate>
    </Suspense>
  );
}
