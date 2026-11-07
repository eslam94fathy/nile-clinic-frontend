import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { LoadingState } from "@/components/shared/states/loading-state";
import { NotFoundState } from "@/components/shared/states/not-found-state";
import { ScreenGate } from "@/features/auth/public-server";
import { PatientHistory } from "@/features/encounters/components/patient-history";
import { readPositiveId } from "@/lib/api/read-positive-id";
import { ScopedMessages } from "@/lib/i18n/scoped-messages";

/** Nothing is read here: a history is read in the browser, because each read writes an entry (ADR 0012). */
export default async function PatientHistoryPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const patientId = readPositiveId(id);

  return (
    <Suspense fallback={<LoadingState />}>
      <ScreenGate locale={locale} path="my/patients">
        {patientId === null ? (
          <NotFoundState />
        ) : (
          <ScopedMessages locale={locale} namespaces={["encounters", "auth"]}>
            <PatientHistory patientId={patientId} />
          </ScopedMessages>
        )}
      </ScreenGate>
    </Suspense>
  );
}
