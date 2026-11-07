"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { allMessages, isOutcomeUnknown } from "@/lib/api/refusal";
import { useRouter } from "@/lib/i18n/navigation";
import { startEncounter } from "../api/encounters";
import { recordOpening } from "../opening";
import type { RecordStatus } from "../types";
import { RecordLink } from "./record-link";

/**
 * What a visit offers: start, continue, or open. Starting is one click with no confirmation, as the owner decided: a
 * record can't be deleted, but an empty draft harms nothing (ADR 0014). The API's answer is shown with no read, so
 * starting writes no opening. The API gives no way to tell why it refused, so the list is read again, whose record
 * number offers any record that already exists.
 */
export function RecordAction({
  visitId,
  status,
  encounterId,
  onRefused,
}: {
  visitId: number;
  status: RecordStatus;
  encounterId: number | null;
  /** Reads the list again. By default, the page does. */
  onRefused?: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("encounters.actions");
  const shared = useTranslations("shared.form");
  const router = useRouter();
  const inFlight = useRef(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string>();

  async function start() {
    if (inFlight.current) return;
    inFlight.current = true;
    setWorking(true);
    setMessage(undefined);

    const result = await startEncounter(visitId, locale);
    inFlight.current = false;
    setWorking(false);

    if (result.ok) {
      recordOpening.handOver(result.data);
      router.push(`/my/encounters/${result.data.id}`);
      router.refresh();
      return;
    }

    setMessage(
      isOutcomeUnknown(result.error)
        ? t("startUnknown")
        : allMessages(result.error, shared("generalFailure")).join(" "),
    );
    if (onRefused) onRefused();
    else router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {status !== "none" && encounterId !== null ? (
        <RecordLink id={encounterId}>
          {t(status === "draft" ? "continue" : "open")}
        </RecordLink>
      ) : (
        <Button
          type="button"
          size="sm"
          aria-disabled={working}
          className="aria-disabled:opacity-70"
          onClick={() => void start()}
        >
          {working ? t("starting") : t("start")}
        </Button>
      )}
      {message ? (
        <p
          role="alert"
          className="text-[0.8125rem] font-medium text-destructive"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
