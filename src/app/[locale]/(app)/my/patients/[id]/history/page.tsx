import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { LoadingState } from "@/components/shared/states/loading-state";
import { NotFoundState } from "@/components/shared/states/not-found-state";
import { InactivityLock } from "@/features/auth/public";
import { getCurrentUser, ScreenGate } from "@/features/auth/public-server";
import { PatientHistory } from "@/features/encounters/components/patient-history";
import { readPositiveId } from "@/lib/api/read-positive-id";
import { isLockMarked } from "@/lib/auth/session";
import { ScopedMessages } from "@/lib/i18n/scoped-messages";

/** A history mustn't stay readable on an unattended screen (ADR 0020). */
async function History({
  locale,
  patientId,
}: {
  locale: string;
  patientId: number;
}) {
  // The gate has already read this in the same render, and handled anything but a signed-in person.
  const current = await getCurrentUser(locale);
  const history = <PatientHistory patientId={patientId} />;

  return (
    <ScopedMessages locale={locale} namespaces={["encounters", "auth"]}>
      {current.kind === "signed-in" ? (
        <InactivityLock
          personId={current.user.id}
          personName={current.user.name}
          startLocked={await isLockMarked()}
        >
          {history}
        </InactivityLock>
      ) : (
        history
      )}
    </ScopedMessages>
  );
}

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
          <History locale={locale} patientId={patientId} />
        )}
      </ScreenGate>
    </Suspense>
  );
}
