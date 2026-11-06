import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/states/loading-state";
import { Button } from "@/components/ui/button";
import { readAppointment } from "@/features/appointments/api/appointments-server";
import { AppointmentActions } from "@/features/appointments/components/appointment-actions";
import { AppointmentDetails } from "@/features/appointments/components/appointment-details";
import { ApiFailureState, ScreenGate } from "@/features/auth/public-server";
import { readPositiveId } from "@/lib/api/read-positive-id";
import { getEnv } from "@/lib/config/env";
import { clinicNow } from "@/lib/format/clinic-now";
import { clinicToday } from "@/lib/format/clinic-today";
import { Link } from "@/lib/i18n/navigation";
import { ScopedMessages } from "@/lib/i18n/scoped-messages";

type Params = Promise<{ locale: string; id: string }>;

async function AppointmentPageContent({ params }: { params: Params }) {
  const { locale, id: rawId } = await params;
  const id = readPositiveId(rawId);
  if (id === null) notFound();

  const t = await getTranslations({ locale, namespace: "appointments" });
  const result = await readAppointment(locale, id);
  if (!result.ok) return <ApiFailureState error={result.error} />;

  const appointment = result.data.data;
  const timeZone = getEnv().CLINIC_TIMEZONE;

  return (
    <>
      <PageHeader
        title={t("details.title", { number: String(appointment.id) })}
        actions={
          <Button variant="outline" asChild>
            <Link href="/appointments" prefetch={false}>
              {t("details.back")}
            </Link>
          </Button>
        }
      />
      {appointment.outside_availability ? (
        <div
          role="note"
          className="flex flex-col gap-1 rounded-lg border border-status-warning-border bg-status-warning p-3 text-status-warning-foreground"
        >
          <p className="font-medium">{t("outsideNotice.title")}</p>
          <p>{t("outsideNotice.description")}</p>
        </div>
      ) : null}
      <AppointmentDetails appointment={appointment} timeZone={timeZone} />
      <ScopedMessages
        locale={locale}
        namespaces={["appointments", "scheduling", "auth"]}
      >
        <AppointmentActions
          appointment={appointment}
          today={clinicToday(timeZone)}
          clinicNow={clinicNow(timeZone)}
        />
      </ScopedMessages>
    </>
  );
}

export default async function AppointmentPage({ params }: { params: Params }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<LoadingState />}>
      <ScreenGate locale={locale} path="appointments">
        <AppointmentPageContent params={params} />
      </ScreenGate>
    </Suspense>
  );
}
