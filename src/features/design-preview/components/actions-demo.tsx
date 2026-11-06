"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";

export type ActionsText = {
  open: string;
  openFailing: string;
  title: string;
  description: string;
  confirm: string;
  failure: string;
  success: string;
  showSuccess: string;
  showFailure: string;
  failureNotice: string;
};

// Stands in for a request to the backend, so the pending state can be seen and tested.
const SIMULATED_REQUEST_MS = 1200;

function ConfirmDemo({
  label,
  fails,
  text,
}: {
  label: string;
  fails: boolean;
  text: ActionsText;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="outline">
          {label}
        </Button>
      }
      title={text.title}
      description={text.description}
      confirmLabel={text.confirm}
      irreversible
      destructive
      pending={pending}
      {...(error ? { error } : {})}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(undefined);
      }}
      onConfirm={() => {
        setPending(true);
        setError(undefined);
        setTimeout(() => {
          setPending(false);
          if (fails) {
            setError(text.failure);
          } else {
            setOpen(false);
            toast.success(text.success);
          }
        }, SIMULATED_REQUEST_MS);
      }}
    />
  );
}

export function ActionsDemo({ text }: { text: ActionsText }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ConfirmDemo label={text.open} fails={false} text={text} />
      <ConfirmDemo label={text.openFailing} fails text={text} />
      <Button
        type="button"
        variant="outline"
        onClick={() => toast.success(text.success)}
      >
        {text.showSuccess}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => toast.error(text.failureNotice)}
      >
        {text.showFailure}
      </Button>
    </div>
  );
}
