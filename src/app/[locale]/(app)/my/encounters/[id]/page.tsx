import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { LoadingState } from "@/components/shared/states/loading-state";
import { NotFoundState } from "@/components/shared/states/not-found-state";
import { getOwnDoctorId, ScreenGate } from "@/features/auth/public-server";
import { EncounterRecord } from "@/features/encounters/components/encounter-record";
import { readPositiveId } from "@/lib/api/read-positive-id";
import { getEnv } from "@/lib/config/env";
import { ScopedMessages } from "@/lib/i18n/scoped-messages";

/** Nothing clinical is read here: the record is read in the browser, because each read writes an entry (ADR 0012). */
async function Encounter({ locale, id }: { locale: string; id: number }) {
  return (
    <ScopedMessages locale={locale} namespaces={["encounters", "auth"]}>
      <EncounterRecord
        id={id}
        ownDoctorId={await getOwnDoctorId(locale)}
        timeZone={getEnv().CLINIC_TIMEZONE}
      />
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
