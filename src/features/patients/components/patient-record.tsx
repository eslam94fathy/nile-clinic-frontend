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
import { Link } from "@/lib/i18n/navigation";
import { readPatient } from "../api/patients";
import { takeAsked, takeHandedOver } from "../opening";
import type { Patient } from "../types";
import { PatientDetails } from "./patient-details";

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
  /** The clinic's, for the edit form's date check. */
  today: string;
}) {
  const locale = useLocale();
  const t = useTranslations("patients");
  const [record, setRecord] = useState<Patient | null>(null);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const [reading, setReading] = useState(false);
  const opened = useRef(false);
  const newest = useRef(0);

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
    setFailure(result.error);
    if (losesTheRecord(result.error)) setRecord(null);
  }, [id, locale]);

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

  if (record === null) {
    return failure ? (
      <ApiFailureState error={failure} onRetry={() => void read()} />
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
          <Button variant="outline" asChild>
            <Link href="/patients" prefetch={false}>
              {t("backToSearch")}
            </Link>
          </Button>
        }
      />
      {failure ? (
        <ErrorState
          message={failure.message ?? t("record.outOfDate")}
          action={failure.message ? <p>{t("record.outOfDate")}</p> : undefined}
        />
      ) : null}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{t("record.detailsHeading")}</h2>
        <PatientDetails record={record} timeZone={timeZone} />
      </section>
      <section className="flex flex-col items-start gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={reading}
          onClick={() => void read()}
        >
          {reading ? t("record.reloading") : t("record.reload")}
        </Button>
        <p className="text-[0.8125rem] text-muted-foreground">
          {t("record.reloadHint")}
        </p>
      </section>
    </>
  );
}
