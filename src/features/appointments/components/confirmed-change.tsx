"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import type { ApiError, ApiResult } from "@/lib/api/api-error";
import { useRouter } from "@/lib/i18n/navigation";
import { allMessages, isOutcomeUnknown } from "../refusal";
import { DETAILS_HEADING_ID } from "./appointment-details";

/**
 * Cancel and no-show. Unlike `ConfirmedAction`, a refusal closes the dialog and is shown on the page, because
 * the refresh that follows can remove this button, and the dialog and its message with it (research R8).
 */
export function ConfirmedChange({
  label,
  title,
  description,
  confirmLabel,
  success,
  action,
  check,
  onFieldError,
  onReset,
  onDone,
  onRefused,
  onUnknownOutcome,
  children,
}: {
  label: string;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  success: string;
  action: () => Promise<ApiResult<unknown>>;
  /** Quick feedback on what's in `children`, before anything is sent. */
  check?: () => boolean;
  /** Whether the refusal belongs to a field in `children`, which then stays open to correct it. */
  onFieldError?: (error: ApiError) => boolean;
  onReset?: () => void;
  onDone: () => void;
  onRefused: (messages: string[]) => void;
  onUnknownOutcome: () => void;
  children?: ReactNode;
}) {
  const shared = useTranslations("shared.form");
  const router = useRouter();
  const inFlight = useRef(false);
  const leaving = useRef(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  function close() {
    leaving.current = true;
    setOpen(false);
    onReset?.();
  }

  async function confirm() {
    if (inFlight.current) return;
    if (check && !check()) return;
    inFlight.current = true;
    setPending(true);

    const result = await action();
    inFlight.current = false;
    setPending(false);

    if (result.ok) {
      close();
      toast.success(success);
      onDone();
      router.refresh();
      return;
    }
    if (onFieldError?.(result.error)) return;

    close();
    if (isOutcomeUnknown(result.error)) onUnknownOutcome();
    else onRefused(allMessages(result.error, shared("generalFailure")));
    router.refresh();
  }

  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="outline">
          {label}
        </Button>
      }
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      irreversible
      destructive
      pending={pending}
      onConfirm={() => void confirm()}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onReset?.();
      }}
      onCloseAutoFocus={(event) => {
        // Dismissing returns to the button. After a change or a refusal, the button may be about to go.
        if (!leaving.current) return;
        leaving.current = false;
        event.preventDefault();
        document.getElementById(DETAILS_HEADING_ID)?.focus();
      }}
    >
      {children}
    </ConfirmDialog>
  );
}
