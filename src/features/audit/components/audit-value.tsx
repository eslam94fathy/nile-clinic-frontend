"use client";

import { useTranslations } from "next-intl";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  isKnownStatus,
  type StatusKind,
} from "@/components/shared/status-mapping";
import { ClinicDate } from "@/components/shared/values/clinic-date";
import { ClinicTime } from "@/components/shared/values/clinic-time";
import { LtrText } from "@/components/shared/values/ltr-text";
import { Money } from "@/components/shared/values/money";
import type { Described } from "../describe-value";
import { useAuditLabels } from "../labels";

/**
 * A status as a badge, but only one it knows: `StatusBadge` would say "Unknown status" for any other, which hides
 * what was sent (FR-012). Generic, so the badge's value is checked against its own kind's list.
 */
export function KnownStatus<Kind extends StatusKind>({
  kind,
  value,
}: {
  kind: Kind;
  value: string;
}) {
  return isKnownStatus(kind, value) ? (
    <StatusBadge kind={kind} value={value} />
  ) : (
    <LtrText>{value}</LtrText>
  );
}

/** One kept value, as `describeValue` read it. What isn't known is shown exactly as sent. */
export function AuditValue({ described }: { described: Described }) {
  const t = useTranslations("audit.entry");
  const tActivity = useTranslations("shared.status.activity");
  const labels = useAuditLabels();

  switch (described.kind) {
    case "none":
      return <span>{t("none")}</span>;
    case "status":
      return <KnownStatus kind={described.group} value={described.value} />;
    case "role":
      return <span>{labels.role(described.value)}</span>;
    case "active":
      return (
        <span>{tActivity(described.value ? "active" : "deactivated")}</span>
      );
    case "money":
      return <Money value={described.value} />;
    case "date":
      return <ClinicDate value={described.value} />;
    case "time":
      return <ClinicTime value={described.value} />;
    case "number":
      return <LtrText>{String(described.value)}</LtrText>;
    case "asSent":
      return <LtrText breakable>{described.value}</LtrText>;
  }
}
