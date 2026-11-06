"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  irreversible,
  destructive,
  pending,
  error,
  onConfirm,
  open,
  onOpenChange,
}: {
  /** Must accept a ref, such as a `Button`. Focus returns here on closing. */
  trigger: ReactNode;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: ReactNode;
  irreversible?: boolean;
  destructive?: boolean;
  pending: boolean;
  /** The backend's translated message, shown as sent. The dialog stays open. */
  error?: string;
  onConfirm: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("shared.confirm");

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description}
            {irreversible ? (
              <>
                {" "}
                <strong>{t("irreversible")}</strong>
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="font-medium text-destructive">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          {/* First in the content, so Radix opens the dialog with focus on the safe choice. */}
          <AlertDialogCancel
            aria-disabled={pending}
            onClick={(event) => {
              if (pending) event.preventDefault();
            }}
          >
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            aria-disabled={pending}
            variant={destructive ? "destructive" : "default"}
            onClick={(event) => {
              // Stays open: the caller closes it once the backend has answered.
              event.preventDefault();
              if (!pending) onConfirm();
            }}
          >
            {pending ? t("working") : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
