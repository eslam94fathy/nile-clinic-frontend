import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoadingState } from "@/components/shared/states/loading-state";
import { ScreenGate } from "@/features/auth/public-server";
import { PatientRecord } from "@/features/patients/components/patient-record";
import { readPositiveId } from "@/lib/api/read-positive-id";
import { getEnv } from "@/lib/config/env";
import { ScopedMessages } from "@/lib/i18n/scoped-messages";

type Params = Promise<{ locale: string; id: string }>;

// The record isn't read here. A server read writes a false audit entry after a refresh and the back button,
// so only the browser reads it, once for each time a person asks (ADR 0012).
async function Record({ params }: { params: Params }) {
  const { locale, id: rawId } = await params;
  const id = readPositiveId(rawId);
  if (id === null) notFound();

  return (
    <ScopedMessages locale={locale} namespaces={["patients", "auth"]}>
      <PatientRecord key={id} id={id} timeZone={getEnv().CLINIC_TIMEZONE} />
    </ScopedMessages>
  );
}

export default async function PatientPage({ params }: { params: Params }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<LoadingState />}>
      <ScreenGate locale={locale} path="patients">
        <Record params={params} />
      </ScreenGate>
    </Suspense>
  );
}
