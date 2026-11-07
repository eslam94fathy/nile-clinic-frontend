"use client";

import { useTranslations } from "next-intl";
import { AuditedLink } from "@/components/shared/audited-link";
import { historyOpening, noteHistoryName } from "../opening";

/**
 * The only way to link to a history, as following it writes a true `encounter.history_viewed`. Offer it only where
 * `offered-history.ts` says, as a refused read writes a permanent entry of its own.
 */
export function HistoryLink({
  patientId,
  patientName,
}: {
  patientId: number;
  patientName: string;
}) {
  const t = useTranslations("encounters.actions");

  return (
    <AuditedLink
      href={`/my/patients/${patientId}/history`}
      onAsked={() => {
        historyOpening.markAsked(patientId);
        noteHistoryName(patientId, patientName);
      }}
    >
      {t("history")}
    </AuditedLink>
  );
}
