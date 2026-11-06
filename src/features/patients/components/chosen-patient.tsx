"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { LoadingState } from "@/components/shared/states/loading-state";
import { LtrText } from "@/components/shared/values/ltr-text";
import { UserText } from "@/components/shared/values/user-text";
import { ApiFailureState } from "@/features/auth/public";
import type { ApiError } from "@/lib/api/api-error";
import { useRouter } from "@/lib/i18n/navigation";
import { findPatientById } from "../api/patients";
import type { PatientSummary } from "../types";

type Answer =
  | { kind: "reading" }
  | { kind: "missing" }
  | { kind: "failed"; error: ApiError }
  | { kind: "found"; patient: PatientSummary };

/**
 * Shows who's chosen, by the unaudited list read. This is how to show a patient without opening them, as
 * reading the record writes a permanent entry, and nobody here asked to open it (research R2).
 */
export function ChosenPatient({
  id,
  known,
  action,
  onMissing,
}: {
  id: number;
  /** Already in hand from a list, so nothing is read. */
  known?: PatientSummary | undefined;
  action?: ReactNode;
  /** Instead of the message here, for a screen that shows its own. */
  onMissing?: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("patients");
  const router = useRouter();
  const [answer, setAnswer] = useState<Answer>(
    known ? { kind: "found", patient: known } : { kind: "reading" },
  );
  const asked = useRef(Boolean(known));

  const read = useCallback(async () => {
    setAnswer({ kind: "reading" });
    const result = await findPatientById(id, locale);

    if (!result.ok) {
      // This person may no longer see patients, so the gate and navigation re-decide.
      if (result.error.status === 403) router.refresh();
      setAnswer({ kind: "failed", error: result.error });
      return;
    }
    const [patient] = result.data.data;
    if (patient) {
      setAnswer({ kind: "found", patient });
      return;
    }
    if (onMissing) onMissing();
    else setAnswer({ kind: "missing" });
  }, [id, locale, onMissing, router]);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void read();
  }, [read]);

  if (answer.kind === "reading") return <LoadingState />;
  if (answer.kind === "failed") {
    return <ApiFailureState error={answer.error} onRetry={() => void read()} />;
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
      {answer.kind === "missing" ? (
        <p>{t("chosen.notFound")}</p>
      ) : (
        <p className="min-w-0">
          <span className="font-medium">
            <UserText>{answer.patient.full_name}</UserText>
          </span>
          {" · "}
          <LtrText>{answer.patient.id}</LtrText>
          {" · "}
          <LtrText>{answer.patient.phone}</LtrText>
        </p>
      )}
      {action}
    </div>
  );
}
