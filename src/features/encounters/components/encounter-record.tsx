"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/states/error-state";
import { LoadingState } from "@/components/shared/states/loading-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { ClinicDate } from "@/components/shared/values/clinic-date";
import { Instant } from "@/components/shared/values/instant";
import { UserText } from "@/components/shared/values/user-text";
import { Button } from "@/components/ui/button";
import { ApiFailureState } from "@/features/auth/public";
import { useRouter } from "@/lib/i18n/navigation";
import { hasUnsaved } from "@/lib/unsaved-changes";
import { useAuditedRead } from "@/lib/use-audited-read";
import { readEncounter } from "../api/encounters";
import { recordOpening } from "../opening";
import type { Encounter } from "../types";
import { Addenda } from "./addenda";
import { EncounterForm } from "./encounter-form";
import { EncounterView } from "./encounter-view";
import { HistoryLink } from "./history-link";
import { SessionEndedNotice } from "./session-ended-notice";

/**
 * The reader. Each read writes a permanent `encounter.opened`, so it uses the guarded read, and links here use
 * `RecordLink` (ADR 0012, and `e2e/live/encounters.spec.ts` measures it). A draft gets the form. A finalized record
 * is read only, whoever wrote it, and only its author is offered adding to it.
 */
export function EncounterRecord({
  id,
  ownDoctorId,
  timeZone,
}: {
  id: number;
  ownDoctorId: number | null;
  timeZone: string;
}) {
  const locale = useLocale();
  const t = useTranslations("encounters");
  const router = useRouter();
  const [differs, setDiffers] = useState(false);
  const [justFinalized, setJustFinalized] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  const {
    data: record,
    failure,
    reading,
    read,
    replace,
    clearFailure,
  } = useAuditedRead<Encounter>({
    id,
    // Beside text that's only on screen, a dead session or a refusal mustn't take it away (ADR 0014).
    read: () => readEncounter(id, locale, hasUnsaved()),
    keepOnLoss: hasUnsaved,
    takeAsked: recordOpening.takeAsked,
    takeHandedOver: recordOpening.takeHandedOver,
    onFailure: (error) => {
      // So that the gate and the navigation re-decide. Nothing clinical is read on the server.
      if (error.status === 403) router.refresh();
    },
  });

  useEffect(() => {
    if (justFinalized) heading.current?.focus();
  }, [justFinalized]);

  if (!record) {
    return failure ? (
      <ApiFailureState
        error={failure}
        onRetry={() => {
          // Loading replaces the button, as a second press would write a second opening.
          clearFailure();
          void read();
        }}
      />
    ) : (
      <LoadingState />
    );
  }

  const { patient } = record;

  return (
    <>
      <PageHeader
        title={<UserText>{patient.full_name}</UserText>}
        description={
          <>
            {t("patientLine", { number: String(patient.id) })}
            {" · "}
            {t(`sex.${patient.sex}`)}
            {" · "}
            {t("dateOfBirth")} <ClinicDate value={patient.date_of_birth} />
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-3 text-[0.8125rem] text-muted-foreground">
        <StatusBadge kind="record" value={record.status} />
        <span>
          {t("visitDate")} <ClinicDate value={record.date} />
        </span>
        <span>
          {t("started")}{" "}
          <Instant value={record.started_at} timeZone={timeZone} />
        </span>
      </div>
      {record.status === "draft" ? (
        <EncounterForm
          // A read of a held draft returns what the API holds now, which another tab may have changed. The form copies
          // the record once, so without this it would keep showing the old text as saved, and the next save would
          // overwrite the newer one.
          key={record.last_saved_at}
          readFailure={failure}
          record={record}
          timeZone={timeZone}
          onFinalized={(finalized, changed) => {
            replace(finalized);
            setDiffers(changed);
            setJustFinalized(true);
          }}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {differs ? (
            <p role="alert" className="font-medium">
              {t("finalize.differs")}
            </p>
          ) : null}
          {failure?.status === 401 ? (
            <SessionEndedNotice onSignedInAgain={clearFailure} />
          ) : failure ? (
            <ErrorState message={failure.message ?? t("view.outOfDate")} />
          ) : null}
          <EncounterView
            record={record}
            timeZone={timeZone}
            headingRef={heading}
          />
          <Addenda
            record={record}
            canAdd={record.doctor.id === ownDoctorId}
            timeZone={timeZone}
            onAdded={(addendum) =>
              replace({ ...record, addenda: [...record.addenda, addendum] })
            }
            onReload={() => void read()}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={reading}
              onClick={() => void read()}
            >
              {reading ? t("view.reloading") : t("view.reload")}
            </Button>
            <HistoryLink
              patientId={patient.id}
              patientName={patient.full_name}
            />
          </div>
          <p className="text-[0.8125rem] text-muted-foreground">
            {t("view.reloadHint")}
          </p>
        </div>
      )}
    </>
  );
}
