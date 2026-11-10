"use client";

import { useTranslations } from "next-intl";

/**
 * After a money action whose answer never arrived. The API has no idempotency key, so the action may have been
 * recorded, and sending it again could record it twice (research R4). The region is always present, so that the
 * notice is announced once when it appears.
 */
export function OutcomeUnknownNotice({ shown }: { shown: boolean }) {
  const t = useTranslations("charges");

  return (
    <p
      role="status"
      className={
        shown
          ? "rounded-lg border border-status-warning-border bg-status-warning p-3 font-medium text-status-warning-foreground"
          : "sr-only"
      }
    >
      {shown ? t("outcomeUnknown") : null}
    </p>
  );
}
