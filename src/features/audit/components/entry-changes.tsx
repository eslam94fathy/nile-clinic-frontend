"use client";

import { ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { describeValue } from "../describe-value";
import { useAuditLabels } from "../labels";
import type { AuditChanges, AuditSubject } from "../types";
import { AuditValue } from "./audit-value";

/**
 * The names of the fields changed, and before and after for the few the backend keeps. Before and after read in the
 * reading direction. Nothing else about a change is ever in the trail (research, Facts).
 */
export function EntryChanges({
  changes,
  subject,
}: {
  changes: AuditChanges;
  subject: AuditSubject | null;
}) {
  const t = useTranslations("audit.entry");
  const labels = useAuditLabels();

  return (
    <ul className="flex flex-col gap-1">
      {changes.fields.map((field) => {
        const kept = Object.hasOwn(changes.values, field)
          ? changes.values[field]
          : undefined;
        return (
          <li
            key={field}
            className="flex flex-wrap items-center gap-x-2 gap-y-1"
          >
            <span className="font-medium">{labels.field(field)}</span>
            {kept ? (
              <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <span className="sr-only">{t("before")}</span>
                <AuditValue
                  described={describeValue(subject, field, kept.from)}
                />
                <ArrowRightIcon
                  aria-hidden="true"
                  className="size-3.5 rtl:rotate-180"
                />
                <span className="sr-only">{t("after")}</span>
                <AuditValue
                  described={describeValue(subject, field, kept.to)}
                />
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
