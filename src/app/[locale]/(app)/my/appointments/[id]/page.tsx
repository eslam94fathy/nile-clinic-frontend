import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/states/loading-state";
import { Button } from "@/components/ui/button";
import { readOwnAppointment } from "@/features/appointments/api/appointments-server";
import { OwnAppointmentDetails } from "@/features/appointments/components/own-appointment-details";
import { ApiFailureState, ScreenGate } from "@/features/auth/public-server";
import { readPositiveId } from "@/lib/api/read-positive-id";
import { getEnv } from "@/lib/config/env";
import { Link } from "@/lib/i18n/navigation";

type Params = Promise<{ locale: string; id: string }>;

async function MyAppointment({ params }: { params: Params }) {
  const { locale, id: rawId } = await params;
  const id = readPositiveId(rawId);
  if (id === null) notFound();

  const t = await getTranslations({ locale, namespace: "appointments" });
  const result = await readOwnAppointment(locale, id);
  if (!result.ok) return <ApiFailureState error={result.error} />;

  return (
    <>
      <PageHeader
        title={t("details.title", { number: String(result.data.data.id) })}
        actions={
          <Button variant="outline" asChild>
            <Link href="/my/appointments" prefetch={false}>
              {t("own.title")}
            </Link>
          </Button>
        }
      />
      <OwnAppointmentDetails
        appointment={result.data.data}
        timeZone={getEnv().CLINIC_TIMEZONE}
      />
    </>
  );
}

export default async function MyAppointmentPage({
  params,
}: {
  params: Params;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<LoadingState />}>
      <ScreenGate locale={locale} path="my/appointments">
        <MyAppointment params={params} />
      </ScreenGate>
    </Suspense>
  );
}
