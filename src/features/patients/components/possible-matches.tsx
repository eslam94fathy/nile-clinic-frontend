"use client";

import { useLocale, useTranslations } from "next-intl";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { formatCount } from "@/lib/format/locale";
import type { PatientPage } from "../api/patients";
import { usePatientColumns } from "./patient-columns";

/** Which phone it's about goes with it, as "Register anyway" holds only for that exact phone (research R8). */
export type DuplicateWarning =
  | { kind: "matches"; phone: string; page: PatientPage }
  | { kind: "failed"; phone: string };

/** A warning and never a refusal, because families often share a phone (FR-012). */
export function PossibleMatches({
  warning,
  disabled,
  onRegisterAnyway,
  onTryAgain,
}: {
  warning: DuplicateWarning;
  disabled: boolean;
  onRegisterAnyway: () => void;
  onTryAgain: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("patients.registerForm");
  const tPatients = useTranslations("patients");
  const columns = usePatientColumns();

  const page = warning.kind === "matches" ? warning.page : null;

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-destructive p-4"
    >
      <p className="font-medium">
        {page ? t("matchesTitle") : t("checkFailedTitle")}
      </p>
      <p>
        {page
          ? t("matchesDescription", { total: page.meta.total })
          : t("checkFailedDescription")}
      </p>
      {page ? (
        <DataTable
          columns={columns}
          rows={page.data}
          getRowKey={(patient) => String(patient.id)}
          caption={tPatients("search.caption")}
          state="ready"
        />
      ) : null}
      {page && page.meta.total > page.data.length ? (
        <p className="text-muted-foreground">
          {t("moreMatches", { shown: formatCount(page.data.length, locale) })}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {page ? null : (
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={onTryAgain}
          >
            {t("tryAgain")}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={onRegisterAnyway}
        >
          {t("registerAnyway")}
        </Button>
      </div>
    </div>
  );
}
