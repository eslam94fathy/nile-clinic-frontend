"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/states/error-state";
import { LoadingState } from "@/components/shared/states/loading-state";
import { UserText } from "@/components/shared/values/user-text";
import { Button } from "@/components/ui/button";
import { ApiFailureState } from "@/features/auth/public";
import type { ApiError } from "@/lib/api/api-error";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { losesTheRecord, useAuditedRead } from "@/lib/use-audited-read";
import { readPatient } from "../api/patients";
import { takeAsked, takeHandedOver } from "../opening";
import type { Patient } from "../types";
import { PatientDetails } from "./patient-details";
import { PatientEditForm } from "./patient-edit-form";

/**
 * The reader. Each read writes a permanent `patient.opened` entry, so it uses the guarded read, and links to it
 * use `PatientLink` (ADR 0012, and `e2e/live/patients.spec.ts` measures it).
 */
export function PatientRecord({
  id,
  timeZone,
}: {
  id: number;
  timeZone: string;
}) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("patients");
  const [editing, setEditing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  const {
    data: record,
    failure,
    reading,
    read,
    lose: loseRecord,
    replace,
    clearFailure,
  } = useAuditedRead<Patient>({
    id,
    read: () => readPatient(id, locale),
    takeAsked,
    takeHandedOver,
    onFailure: (error) => {
      if (losesTheRecord(error)) setEditing(false);
      // So that the gate and the navigation re-decide. Nothing about a patient is read on the server.
      if (error.status === 403) router.refresh();
    },
  });

  const lose = (error: ApiError) => {
    loseRecord(error);
    setEditing(false);
  };

  // Saving or cancelling removes the focused button, so focus returns to the one that started this.
  useEffect(() => {
    if (wasEditing.current && !editing) editButton.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  if (record === null) {
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

  return (
    <>
      <PageHeader
        title={<UserText>{record.full_name}</UserText>}
        description={t("record.numberLine", { number: String(record.id) })}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link
                href={`/appointments/new?patient_id=${id}`}
                prefetch={false}
              >
                {t("recordLinks.book")}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/appointments?patient_id=${id}`} prefetch={false}>
                {t("recordLinks.view")}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/queue/walk-in?patient_id=${id}`} prefetch={false}>
                {t("recordLinks.addToQueue")}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/charges?patient_id=${id}`} prefetch={false}>
                {t("recordLinks.charges")}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/patients" prefetch={false}>
                {t("backToSearch")}
              </Link>
            </Button>
          </>
        }
      />
      {failure ? (
        <ErrorState
          message={failure.message ?? t("record.outOfDate")}
          action={failure.message ? <p>{t("record.outOfDate")}</p> : undefined}
        />
      ) : null}
      {editing ? (
        <PatientEditForm
          record={record}
          timeZone={timeZone}
          onCancel={() => setEditing(false)}
          onFailure={(error) => {
            if (losesTheRecord(error)) lose(error);
          }}
          onSaved={(saved) => {
            replace(saved);
            setEditing(false);
          }}
        />
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold">
              {t("record.detailsHeading")}
            </h2>
            <PatientDetails record={record} timeZone={timeZone} />
          </section>
          <section className="flex flex-col items-start gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                ref={editButton}
                type="button"
                onClick={() => setEditing(true)}
              >
                {t("record.edit")}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={reading}
                onClick={() => void read()}
              >
                {reading ? t("record.reloading") : t("record.reload")}
              </Button>
            </div>
            <p className="text-[0.8125rem] text-muted-foreground">
              {t("record.reloadHint")}
            </p>
          </section>
        </>
      )}
    </>
  );
}
