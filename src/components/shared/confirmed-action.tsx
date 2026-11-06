"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ApiResult } from "@/lib/api/api-error";
import { useRouter } from "@/lib/i18n/navigation";
import { ConfirmDialog } from "./confirm-dialog";

/**
 * A button that asks first, calls the API, and refreshes the page. The dialog stays open with the API's
 * message when it refuses, and a `403` or `404` also refreshes, so that the page can re-decide.
 */
export function ConfirmedAction({
  label,
  title,
  description,
  confirmLabel,
  success,
  destructive,
  action,
}: {
  label: string;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  success: string;
  destructive?: boolean;
  action: () => Promise<ApiResult<unknown>>;
}) {
  const t = useTranslations("shared.form");
  const router = useRouter();
  const inFlight = useRef(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function confirm() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(undefined);

    const result = await action();
    inFlight.current = false;
    setPending(false);

    if (result.ok) {
      setOpen(false);
      toast.success(success);
      router.refresh();
      return;
    }

    const messages = Object.values(result.error.fieldErrors).flat();
    setError(messages.join(" ") || result.error.message || t("generalFailure"));
    if (result.error.status === 403 || result.error.status === 404) {
      router.refresh();
    }
  }

  return (
    <ConfirmDialog
      trigger={
        <Button
          type="button"
          variant={destructive ? "destructive" : "outline"}
          size="sm"
        >
          {label}
        </Button>
      }
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      destructive={destructive}
      pending={pending}
      error={error}
      onConfirm={confirm}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(undefined);
      }}
    />
  );
}
