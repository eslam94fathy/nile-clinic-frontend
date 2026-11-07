"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UserText } from "@/components/shared/values/user-text";
import { Button } from "@/components/ui/button";
import { allMessages, isOutcomeUnknown } from "@/lib/api/refusal";
import { callNext, finishVisit } from "../api/queue";
import { offeredOwnAction } from "../offered-own-action";
import type { OwnQueueEntry } from "../types";

type Asking = { kind: "call_next" } | { kind: "finish"; patientName: string };

/**
 * Call next and finish. Neither can be undone, as the API has no way to send a called patient back, so each asks
 * first (FR-023). "Call next" names nobody until the API answers, as the API decides who's next and may skip
 * someone. The dialog holds its own copy of what it's about, so a refresh can't change it (research R5).
 */
export function OwnQueueActions({
  entries,
  headingId,
  onAnswered,
  refresh,
}: {
  entries: OwnQueueEntry[];
  headingId: string;
  /** Puts the API's answer on screen, even if the read that follows fails. */
  onAnswered: (entry: OwnQueueEntry) => void;
  refresh: () => Promise<void>;
}) {
  const locale = useLocale();
  const t = useTranslations("queue.own");
  const tQueue = useTranslations("queue");
  const shared = useTranslations("shared.form");
  const inFlight = useRef(false);
  const button = useRef<HTMLButtonElement>(null);
  const [asking, setAsking] = useState<Asking | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const offered = offeredOwnAction(entries);
  const current = entries.find(({ status }) => status === "with_doctor");

  function ask(next: Asking) {
    setAsking(next);
    setError(undefined);
    setOpen(true);
  }

  async function confirm() {
    if (!asking || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(undefined);

    const isFinish = asking.kind === "finish";
    const result = isFinish
      ? await finishVisit(locale)
      : await callNext(locale);
    inFlight.current = false;
    setPending(false);

    if (result.ok) {
      setOpen(false);
      onAnswered(result.data);
      toast.success(
        t(isFinish ? "finish.done" : "callNext.done", {
          name: result.data.patient.full_name,
        }),
      );
    } else if (isOutcomeUnknown(result.error)) {
      setError(tQueue("unknownOutcome"));
    } else {
      setError(allMessages(result.error, shared("generalFailure")).join(" "));
    }
    void refresh();
  }

  const isFinish = asking?.kind === "finish";

  return (
    <>
      {offered === "finish" && current ? (
        <div>
          <Button
            ref={button}
            type="button"
            onClick={() =>
              ask({ kind: "finish", patientName: current.patient.full_name })
            }
          >
            {t("finish.action")}
          </Button>
        </div>
      ) : offered === "call_next" ? (
        <div>
          <Button
            ref={button}
            type="button"
            onClick={() => ask({ kind: "call_next" })}
          >
            {t("callNext.action")}
          </Button>
        </div>
      ) : null}
      <ConfirmDialog
        title={t(isFinish ? "finish.title" : "callNext.title")}
        description={
          asking?.kind === "finish" ? (
            <>
              <UserText>{asking.patientName}</UserText>
              {" — "}
              {t("finish.description")}
            </>
          ) : (
            t("callNext.description")
          )
        }
        confirmLabel={t(isFinish ? "finish.confirm" : "callNext.confirm")}
        irreversible
        pending={pending}
        {...(error ? { error } : {})}
        onConfirm={() => void confirm()}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(undefined);
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          (button.current ?? document.getElementById(headingId))?.focus();
        }}
      />
    </>
  );
}
