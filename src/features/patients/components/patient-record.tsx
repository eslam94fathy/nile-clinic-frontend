"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/states/error-state";
import { LoadingState } from "@/components/shared/states/loading-state";
import { UserText } from "@/components/shared/values/user-text";
import { Button } from "@/components/ui/button";
import { ApiFailureState } from "@/features/auth/public";
import type { ApiError } from "@/lib/api/api-error";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { readPatient } from "../api/patients";
import { takeAsked, takeHandedOver } from "../opening";
import type { Patient } from "../types";
import { PatientDetails } from "./patient-details";
import { PatientEditForm } from "./patient-edit-form";

/** After these, the person may not see this record at all, so nothing already on screen can stay. */
const losesTheRecord = (error: ApiError) =>
  error.status === 403 || error.status === 404;

/**
 * The reader. Each read writes a permanent `patient.opened` entry, so this reads only on first being
 * shown, after a click on `PatientLink`, and when the person asks. Nothing else: a refresh or being shown
 * again from hidden leaves the state as it is (ADR 0012, and `e2e/live/patients.spec.ts` measures it).
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
  const [record, setRecord] = useState<Patient | null>(null);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const [reading, setReading] = useState(false);
  const [editing, setEditing] = useState(false);
  const opened = useRef(false);
  const newest = useRef(0);
  const editButton = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  const lose = useCallback((error: ApiError) => {
    // A read still on its way mustn't put back what was just removed.
    newest.current += 1;
    setReading(false);
    setFailure(error);
    setRecord(null);
    setEditing(false);
  }, []);

  const read = useCallback(async () => {
    newest.current += 1;
    const request = newest.current;
    setReading(true);

    const result = await readPatient(id, locale);
    if (request !== newest.current) return;

    setReading(false);
    if (result.ok) {
      setRecord(result.data);
      setFailure(null);
      return;
    }
    if (losesTheRecord(result.error)) lose(result.error);
    else setFailure(result.error);
    // So that the gate and the navigation re-decide. Nothing about a patient is read on the server.
    if (result.error.status === 403) router.refresh();
  }, [id, locale, lose, router]);

  // This runs on mounting, and again each time a held page is shown. The ref and the mark are what decide.
  useEffect(() => {
    const asked = takeAsked(id);
    if (opened.current && !asked) return;
    opened.current = true;

    const handedOver = takeHandedOver(id);
    if (handedOver) {
      // This comes from outside React, and taking it during render could use it up on a hidden prerender.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronizing with that outside value
      setRecord(handedOver);
      return;
    }
    void read();
  }, [id, read]);

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
          setFailure(null);
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
            // Whatever a read still on its way says, it's older than this.
            newest.current += 1;
            setReading(false);
            setRecord(saved);
            setFailure(null);
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
