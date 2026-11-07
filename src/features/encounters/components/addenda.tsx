"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormError } from "@/components/shared/form/form-error";
import { FormField } from "@/components/shared/form/form-field";
import { UnsavedChangesGuard } from "@/components/shared/unsaved-changes-guard";
import { Instant } from "@/components/shared/values/instant";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useHydrated } from "@/features/auth/public";
import { isOutcomeUnknown } from "@/lib/api/refusal";
import { useFormSubmit } from "@/lib/api/use-form-submit";
import { addAddendum } from "../api/encounters";
import { CLINICAL_INPUT } from "../clinical-input";
import type { Addendum, Encounter } from "../types";
import { ClinicalText } from "./clinical-text";
import { SessionEndedNotice } from "./session-ended-notice";

const FIELDS = ["text"] as const;

function AddendumForm({
  recordId,
  onAdded,
  onReload,
}: {
  recordId: number;
  onAdded: (addendum: Addendum) => void;
  onReload: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("encounters.addenda");
  const shared = useTranslations("shared.form");
  const hydrated = useHydrated();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [asking, setAsking] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const {
    register,
    getValues,
    reset,
    setError,
    clearErrors,
    control,
    formState: { errors },
  } = useForm<{ text: string }>({ defaultValues: { text: "" } });
  const { working, formErrors, setFormErrors, submit } = useFormSubmit<{
    text: string;
  }>({
    fields: FIELDS,
    setError,
    generalFailure: shared("generalFailure"),
    keepOnRefusal: true,
  });
  const text = useWatch({ control, name: "text" });
  const field = register("text");

  async function add() {
    clearErrors();
    setUnknown(false);
    await submit(
      () => addAddendum(recordId, getValues("text"), locale),
      (addendum) => {
        setSessionEnded(false);
        reset({ text: "" });
        onAdded(addendum);
        toast.success(t("done"));
      },
      (error) => {
        if (error.status === 401) {
          setSessionEnded(true);
          setFormErrors([]);
        } else if (isOutcomeUnknown(error)) {
          setUnknown(true);
          setFormErrors([t("unknown")]);
        } else if (error.status === 500) {
          setFormErrors([t("notAdded")]);
        }
      },
    );
    setAsking(false);
  }

  return (
    <form
      // POST, so that even a browser-handled submit can't put clinical text in the address.
      method="post"
      noValidate
      autoComplete="off"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!working) setAsking(true);
      }}
    >
      {sessionEnded ? (
        <SessionEndedNotice onSignedInAgain={() => setSessionEnded(false)} />
      ) : null}
      <FormError messages={formErrors} />
      <FormField
        label={t("label")}
        hint={t("hint")}
        {...(errors.text?.message ? { error: errors.text.message } : {})}
      >
        {(input) => (
          <Textarea
            {...input}
            {...CLINICAL_INPUT}
            rows={4}
            readOnly={working}
            {...field}
            ref={(element) => {
              field.ref(element);
              inputRef.current = element;
            }}
          />
        )}
      </FormField>
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={!hydrated}
          aria-disabled={working}
          className="aria-disabled:opacity-70"
        >
          {working ? t("working") : t("add")}
        </Button>
        {unknown ? (
          <Button type="button" variant="outline" onClick={onReload}>
            {t("openRecord")}
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        title={t("title")}
        description={t("description")}
        confirmLabel={t("confirm")}
        irreversible
        pending={working}
        open={asking}
        onOpenChange={setAsking}
        onConfirm={() => void add()}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      />
      <UnsavedChangesGuard
        unsaved={text.trim() !== ""}
        onDiscard={() => reset({ text: "" })}
        onSessionEnded={() => setSessionEnded(true)}
      />
    </form>
  );
}

/** Corrections to a finalized record, oldest first. Only its author is offered adding one, and the API decides. */
export function Addenda({
  record,
  canAdd,
  timeZone,
  onAdded,
  onReload,
}: {
  record: Encounter;
  canAdd: boolean;
  timeZone: string;
  onAdded?: (addendum: Addendum) => void;
  onReload?: () => void;
}) {
  const t = useTranslations("encounters.addenda");

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-semibold">{t("heading")}</h3>
      {record.addenda.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {record.addenda.map((addendum) => (
            <li key={addendum.id} className="rounded-lg border p-3">
              <p className="text-[0.8125rem] text-muted-foreground">
                {t("addedAt")}{" "}
                <Instant value={addendum.created_at} timeZone={timeZone} />
              </p>
              <ClinicalText value={addendum.text} />
            </li>
          ))}
        </ol>
      )}
      {canAdd && onAdded && onReload ? (
        <AddendumForm
          recordId={record.id}
          onAdded={onAdded}
          onReload={onReload}
        />
      ) : null}
    </section>
  );
}
