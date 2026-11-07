"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";

/** Asks first, as this can't be undone. What it does is the form's, as it may need to save before it locks. */
export function FinalizeAction({
  disabled,
  working,
  onConfirm,
}: {
  disabled: boolean;
  working: boolean;
  onConfirm: () => Promise<void>;
}) {
  const t = useTranslations("encounters.finalize");
  const [open, setOpen] = useState(false);

  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="outline" disabled={disabled}>
          {t("action")}
        </Button>
      }
      title={t("title")}
      description={t("description")}
      confirmLabel={t("confirm")}
      irreversible
      pending={working}
      open={open}
      onOpenChange={setOpen}
      onConfirm={() => {
        // Any refusal belongs on the fields behind the dialog, so it closes either way.
        void onConfirm().finally(() => setOpen(false));
      }}
    />
  );
}
