"use client";

import { useTranslations } from "next-intl";
import { ClinicDate } from "@/components/shared/values/clinic-date";
import { LtrText } from "@/components/shared/values/ltr-text";
import { useAuditLabels } from "../labels";
import type { SearchedFilters as Filters } from "../types";

// The search form's own labels, so a recorded search reads the way it was asked.
const LABELS: Record<string, string> = {
  from: "from",
  to: "to",
  staff_id: "staffNumber",
  patient_id: "patient",
  subject_type: "subjectType",
  subject_id: "subjectNumber",
  action: "action",
  outcome: "outcome",
};

/** What an `audit.searched` entry recorded: the filters that search used, as label and value pairs. */
export function SearchedFilters({ filters }: { filters: Filters }) {
  const t = useTranslations("audit");
  const labels = useAuditLabels();
  const entries = Object.entries(filters);

  if (entries.length === 0) return <span>{t("entry.noFilters")}</span>;

  const valueOf = (name: string, value: string | number) => {
    const text = String(value);
    if (name === "action") return labels.action(text);
    if (name === "outcome") return labels.outcome(text);
    if (name === "subject_type") return labels.subject(text);
    if (name === "from" || name === "to") return <ClinicDate value={text} />;
    return <LtrText>{text}</LtrText>;
  };

  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1">
      {entries.map(([name, value]) => {
        const label = LABELS[name];
        return (
          <div key={name} className="flex gap-1.5">
            <dt className="text-muted-foreground">
              {label ? t(`filters.${label}`) : <LtrText>{name}</LtrText>}
            </dt>
            <dd>{valueOf(name, value)}</dd>
          </div>
        );
      })}
    </dl>
  );
}
