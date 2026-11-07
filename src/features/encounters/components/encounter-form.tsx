"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useRef, useState } from "react";
import { type FieldPath, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { FormError } from "@/components/shared/form/form-error";
import { FormField } from "@/components/shared/form/form-field";
import { ErrorState } from "@/components/shared/states/error-state";
import { UnsavedChangesGuard } from "@/components/shared/unsaved-changes-guard";
import { Instant } from "@/components/shared/values/instant";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useHydrated } from "@/features/auth/public";
import type { ApiError, ApiResult } from "@/lib/api/api-error";
import { isOutcomeUnknown } from "@/lib/api/refusal";
import { useFormSubmit } from "@/lib/api/use-form-submit";
import { finalizeEncounter, saveEncounter } from "../api/encounters";
import { CLINICAL_INPUT } from "../clinical-input";
import { withScreenLines } from "../error-rows";
import { hasChanged, recordToForm, toRequest } from "../form-values";
import { offeredForDraft } from "../offered-history";
import {
  CONTENT_FIELDS,
  type Encounter,
  type EncounterFormValues,
  LINE_FIELDS,
  MOST_LINES,
} from "../types";
import { useHistoryPanel } from "../use-history-panel";
import { useTodaysPatients } from "../use-todays-patients";
import { FinalizeAction } from "./finalize-action";
import { HistoryPanel } from "./history-panel";
import { PrescriptionLines } from "./prescription-lines";
import { SessionEndedNotice } from "./session-ended-notice";

const LABELS = {
  chief_complaint: "chiefComplaint",
  examination_findings: "examinationFindings",
  diagnosis: "diagnosis",
  treatment_plan: "treatmentPlan",
} as const;

const FIELD_PATHS: readonly FieldPath<EncounterFormValues>[] = [
  ...CONTENT_FIELDS,
  ...Array.from({ length: MOST_LINES }, (_, index) =>
    LINE_FIELDS.map(
      (field): FieldPath<EncounterFormValues> =>
        `prescriptions.${index}.${field}`,
    ),
  ).flat(),
];

type Stage = "save" | "finalize";

/**
 * Writing a draft. What's typed exists only here, so every failure keeps it, and nothing saves except by the doctor's
 * own action (ADR 0014). A change's answer replaces the saved record, with no read, as a read writes an entry.
 */
export function EncounterForm({
  readFailure,
  record,
  timeZone,
  onFinalized,
}: {
  /** The latest read of this record failed, so what's here may be out of date. */
  readFailure: ApiError | null;
  record: Encounter;
  timeZone: string;
  /** `differs`: another tab saved something else, so what was locked isn't what was on screen. */
  onFinalized: (finalized: Encounter, differs: boolean) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("encounters");
  const shared = useTranslations("shared.form");
  const hydrated = useHydrated();
  const [saved, setSaved] = useState(record);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [lockedElsewhere, setLockedElsewhere] = useState(false);
  const [finalizeUnknown, setFinalizeUnknown] = useState(false);
  const stage = useRef<Stage>("save");
  const historyButton = useRef<HTMLButtonElement>(null);
  const statusLine = useRef<HTMLParagraphElement>(null);
  const today = useTodaysPatients();

  const {
    register,
    control,
    getValues,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<EncounterFormValues>({ defaultValues: recordToForm(record) });

  const { working, formErrors, setFormErrors, submit } =
    useFormSubmit<EncounterFormValues>({
      fields: FIELD_PATHS,
      setError,
      generalFailure: shared("generalFailure"),
      keepOnRefusal: true,
    });

  const noteSessionEnded = useCallback(() => setSessionEnded(true), []);
  const panel = useHistoryPanel(record.patient.id, noteSessionEnded);

  // Every field has a default, so nothing is really partial, as useWatch's type allows for.
  const values = useWatch({ control }) as EncounterFormValues;
  const unsaved = useMemo(() => hasChanged(values, saved), [values, saved]);

  function takeAnswer(answer: Encounter) {
    setSessionEnded(false);
    setSaved(answer);
    reset(recordToForm(answer));
  }

  function explain(error: ApiError) {
    const isFinalize = stage.current === "finalize";
    if (error.status === 401) {
      setSessionEnded(true);
      setFormErrors([]);
    } else if (isOutcomeUnknown(error)) {
      setFinalizeUnknown(isFinalize);
      setFormErrors([
        t(isFinalize ? "failure.finalizeUnknown" : "failure.saveUnknown"),
      ]);
    } else if (error.status === 500) {
      setFormErrors([
        t(isFinalize ? "failure.notFinalized" : "failure.notSaved"),
      ]);
    } else if (error.status === 403 || error.status === 404) {
      setStopped(true);
      setFormErrors([
        error.message ?? t("failure.stopped"),
        t("failure.stopped"),
      ]);
    }
    if ("encounter" in error.fieldErrors) setLockedElsewhere(true);
  }

  function beginRequest() {
    clearErrors();
    setFinalizeUnknown(false);
  }

  async function sendSave(): Promise<ApiResult<Encounter>> {
    stage.current = "save";
    const { body, sentLines } = toRequest(getValues());
    const result = await saveEncounter(saved.id, body, locale);
    return result.ok
      ? result
      : { ok: false, error: withScreenLines(result.error, sentLines) };
  }

  async function save() {
    if (!hasChanged(getValues(), saved)) {
      setFormErrors([shared("nothingToSave")]);
      return;
    }
    beginRequest();
    await submit(
      sendSave,
      (answer) => {
        takeAnswer(answer);
        toast.success(t("save.done"));
      },
      explain,
    );
  }

  /**
   * Finalizing takes no content and locks what the API holds, so what's on screen is saved first, and a save that
   * doesn't succeed stops it there (research R4). The form takes the saved values before locking, so that the line
   * numbers in any refusal match what's on screen.
   */
  async function finalize() {
    beginRequest();
    const shown = getValues();

    await submit(
      async (): Promise<ApiResult<Encounter>> => {
        if (hasChanged(shown, saved)) {
          const result = await sendSave();
          if (!result.ok) return result;
          takeAnswer(result.data);
        }
        stage.current = "finalize";
        const { sentLines } = toRequest(getValues());
        const result = await finalizeEncounter(saved.id, locale);
        return result.ok
          ? result
          : { ok: false, error: withScreenLines(result.error, sentLines) };
      },
      (answer) => {
        toast.success(t("finalize.done"));
        onFinalized(answer, hasChanged(shown, answer));
      },
      explain,
    );
  }

  const canSend = hydrated && !stopped;
  const offeredHistory = offeredForDraft(record.patient.id, today);
  const panelOpen = panel.state.view !== "closed";

  return (
    <div className={panelOpen ? "grid items-start gap-6 lg:grid-cols-2" : ""}>
      <form
        // POST, so that even a browser-handled submit can't put clinical text in the address.
        method="post"
        noValidate
        autoComplete="off"
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSend && !working) void save();
        }}
      >
        <p className="text-[0.8125rem] text-muted-foreground">
          {t("form.noAutomaticSave")}
        </p>
        <p
          ref={statusLine}
          role="status"
          tabIndex={-1}
          className="font-medium outline-none"
        >
          {unsaved ? t("status.unsaved") : t("status.saved")}
          <span className="font-normal text-muted-foreground">
            {" · "}
            {t("status.savedAt")}{" "}
            <Instant value={saved.last_saved_at} timeZone={timeZone} />
          </span>
        </p>
        {sessionEnded ? (
          <SessionEndedNotice onSignedInAgain={() => setSessionEnded(false)} />
        ) : null}
        <FormError messages={formErrors} />
        {readFailure ? (
          <ErrorState message={readFailure.message ?? t("view.outOfDate")} />
        ) : null}
        {lockedElsewhere || finalizeUnknown ? (
          <div className="flex flex-col items-start gap-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => void panel.openRecord(saved.id)}
            >
              {t("failure.openAsItStands")}
            </Button>
            <p className="text-[0.8125rem] text-muted-foreground">
              {t("failure.openNote")}
            </p>
          </div>
        ) : null}
        {CONTENT_FIELDS.map((field) => {
          const error = errors[field]?.message;
          return (
            <FormField
              key={field}
              label={t(`form.${LABELS[field]}`)}
              hint={t("form.textHint")}
              {...(error ? { error } : {})}
            >
              {(input) => (
                <Textarea
                  {...input}
                  {...CLINICAL_INPUT}
                  rows={field === "chief_complaint" ? 3 : 5}
                  readOnly={working}
                  {...register(field)}
                />
              )}
            </FormField>
          );
        })}
        <PrescriptionLines
          control={control}
          register={register}
          errors={errors}
          locked={working}
        />
        {stopped ? null : (
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={!hydrated}
              aria-disabled={working}
              className="aria-disabled:opacity-70"
            >
              {working ? t("save.working") : t("save.action")}
            </Button>
            <FinalizeAction
              disabled={!canSend}
              working={working}
              onConfirm={finalize}
            />
            {offeredHistory && !panelOpen ? (
              <Button
                ref={historyButton}
                type="button"
                variant="outline"
                onClick={() => void panel.openHistory()}
              >
                {t("panel.open")}
              </Button>
            ) : null}
          </div>
        )}
        <UnsavedChangesGuard
          unsaved={unsaved}
          onDiscard={() => reset(recordToForm(saved))}
          onSessionEnded={noteSessionEnded}
        />
      </form>
      {panelOpen ? (
        <HistoryPanel
          panel={panel}
          timeZone={timeZone}
          onClosed={() => {
            // It comes back with the panel gone, so wait for that.
            requestAnimationFrame(() =>
              (historyButton.current ?? statusLine.current)?.focus(),
            );
          }}
        />
      ) : null}
    </div>
  );
}
