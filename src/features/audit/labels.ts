"use client";

import { useTranslations } from "next-intl";

/**
 * The trail's identifiers in words. Anything with no translation, such as a field added to the backend later, is
 * shown exactly as sent: never as a message key, and never hidden (FR-012). The page's schema accepts any action,
 * outcome, record type, or role, so each of them can be new here.
 */
export function useAuditLabels() {
  const t = useTranslations("audit");
  const tRoles = useTranslations("roles");

  const inAudit = (key: string, value: string) => (t.has(key) ? t(key) : value);

  return {
    action: (value: string) => inAudit(`actions.${value}`, value),
    outcome: (value: string) => inAudit(`outcomes.${value}`, value),
    subject: (value: string) => inAudit(`subjects.${value}`, value),
    // Field names hold no dots, so one that does is never read as a path into the messages.
    field: (value: string) =>
      value.includes(".") ? value : inAudit(`fields.${value}`, value),
    role: (value: string) => (tRoles.has(value) ? tRoles(value) : value),
  };
}

export type AuditLabels = ReturnType<typeof useAuditLabels>;
