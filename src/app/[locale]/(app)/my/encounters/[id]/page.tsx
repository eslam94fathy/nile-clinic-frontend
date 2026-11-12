import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { LoadingState } from "@/components/shared/states/loading-state";
import { NotFoundState } from "@/components/shared/states/not-found-state";
import { InactivityLock } from "@/features/auth/public";
import {
  getCurrentUser,
  getOwnDoctorId,
  ScreenGate,
} from "@/features/auth/public-server";
import { EncounterRecord } from "@/features/encounters/components/encounter-record";
import { readPositiveId } from "@/lib/api/read-positive-id";
import { isLockMarked } from "@/lib/auth/session";
import { getEnv } from "@/lib/config/env";
import { ScopedMessages } from "@/lib/i18n/scoped-messages";

/** Nothing clinical is read here: the record is read in the browser, because each read writes an entry (ADR 0012). */
async function Encounter({ locale, id }: { locale: string; id: number }) {
  // The gate has already read this in the same render, and handled anything but a signed-in person.
  const current = await getCurrentUser(locale);
  const record = (
    <EncounterRecord
      id={id}
      ownDoctorId={await getOwnDoctorId(locale)}
      timeZone={getEnv().CLINIC_TIMEZONE}
    />
  );

  return (
    <ScopedMessages locale={locale} namespaces={["encounters", "auth"]}>
      {/* A record mustn't stay readable on an unattended screen (ADR 0020). */}
      {current.kind === "signed-in" ? (
        <InactivityLock
          personId={current.user.id}
          personName={current.user.name}
          startLocked={await isLockMarked()}
        >
          {record}
        </InactivityLock>
      ) : (
        record
      )}
    </ScopedMessages>
  );
}

export default async function EncounterPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const recordId = readPositiveId(id);

  return (
    <Suspense fallback={<LoadingState />}>
      <ScreenGate locale={locale} path="my/encounters">
        {recordId === null ? (
          <NotFoundState />
        ) : (
          <Encounter locale={locale} id={recordId} />
        )}
      </ScreenGate>
    </Suspense>
  );
}
