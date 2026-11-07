"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UserText } from "@/components/shared/values/user-text";
import { allMessages, isOutcomeUnknown } from "@/lib/api/refusal";
import { markLeft, undoCheckIn } from "../api/queue";
import type { EntryAction } from "../offered-entry-actions";
import type { QueueEntry } from "../types";

export type EntryActionRequest = { entry: QueueEntry; action: EntryAction };

/**
 * Above the rows, holding its own copy of what it's about, so that a refresh that changes or removes the row can't
 * close it or change its text (research R5). A refusal stays here with the API's message, and the list is read
 * again underneath, as nothing here can be removed by that.
 */
export function EntryActionDialog({
  request,
  open,
  onClose,
  onCloseAutoFocus,
  refresh,
}: {
  /** Kept after closing, so that the text doesn't vanish while the dialog fades. */
  request: EntryActionRequest | null;
  open: boolean;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
  refresh: () => Promise<void>;
}) {
  const locale = useLocale();
  const t = useTranslations("queue");
  const shared = useTranslations("shared.form");
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function confirm() {
    if (!request || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(undefined);

    const { entry, action } = request;
    const result =
      action === "undo"
        ? await undoCheckIn(entry.id, locale)
        : await markLeft(entry.id, locale);
    inFlight.current = false;
    setPending(false);

    if (result.ok) {
      onClose();
      toast.success(t(action === "undo" ? "undo.done" : "left.done"));
    } else if (isOutcomeUnknown(result.error)) {
      setError(t("unknownOutcome"));
    } else {
      setError(allMessages(result.error, shared("generalFailure")).join(" "));
    }
    void refresh();
  }

  const name = request ? (
    <UserText>{request.entry.patient.full_name}</UserText>
  ) : null;
  const isUndo = request?.action === "undo";

  return (
    <ConfirmDialog
      title={t(isUndo ? "undo.title" : "left.title")}
      description={
        <>
          {name}
          {" — "}
          {t(isUndo ? "undo.description" : "left.description")}
        </>
      }
      confirmLabel={t(isUndo ? "undo.confirm" : "left.confirm")}
      irreversible={!isUndo}
      destructive
      pending={pending}
      {...(error ? { error } : {})}
      onConfirm={() => void confirm()}
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        setError(undefined);
        onClose();
      }}
      onCloseAutoFocus={onCloseAutoFocus}
    />
  );
}
