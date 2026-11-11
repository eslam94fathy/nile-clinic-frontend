"use client";

import { useTranslations } from "next-intl";
import type { FilterDefinition } from "@/components/shared/filter-bar";
import { ACTION_GROUPS } from "../action-groups";
import { useAuditLabels } from "../labels";
import { AUDIT_OUTCOMES, AUDIT_SUBJECTS } from "../types";

export type StaffChoice = { id: number; name: string; is_active: boolean };

/**
 * The search's filters. **None goes in the address** (clarification 1): a reload, a link, or the back button must
 * never be able to repeat a search, as each one is recorded. Their names are the API's own, so its `422`s land on
 * the right field.
 */
export function useAuditFilters(
  staff: StaffChoice[] | null,
): FilterDefinition[] {
  const t = useTranslations("audit");
  const labels = useAuditLabels();
  const any = { value: "", label: t("filters.any") };

  // If the accounts couldn't be read, a number still works, so the page does too (research R7).
  const staffFilter: FilterDefinition = staff
    ? {
        name: "staff_id",
        label: t("filters.staff"),
        hint: t("filters.staffHint"),
        type: "select",
        inAddress: false,
        options: [
          any,
          ...staff.map(({ id, name, is_active }) => ({
            value: String(id),
            label: is_active ? name : t("filters.deactivated", { name }),
          })),
        ],
      }
    : {
        name: "staff_id",
        label: t("filters.staffNumber"),
        hint: t("filters.staffHint"),
        type: "text",
        inAddress: false,
      };

  return [
    { name: "from", label: t("filters.from"), type: "date", inAddress: false },
    { name: "to", label: t("filters.to"), type: "date", inAddress: false },
    staffFilter,
    {
      name: "patient_id",
      label: t("filters.patient"),
      type: "text",
      inAddress: false,
    },
    {
      name: "subject_type",
      label: t("filters.subjectType"),
      hint: t("filters.subjectHint"),
      type: "select",
      inAddress: false,
      options: [
        any,
        ...AUDIT_SUBJECTS.map((subject) => ({
          value: subject,
          label: labels.subject(subject),
        })),
      ],
    },
    {
      name: "subject_id",
      label: t("filters.subjectNumber"),
      type: "text",
      inAddress: false,
    },
    {
      name: "action",
      label: t("filters.action"),
      type: "select",
      inAddress: false,
      options: [
        any,
        ...ACTION_GROUPS.flatMap(({ group, actions }) =>
          actions.map((action) => ({
            value: action,
            label: labels.action(action),
            group: t(`actionGroups.${group}`),
          })),
        ),
      ],
    },
    {
      name: "outcome",
      label: t("filters.outcome"),
      type: "select",
      inAddress: false,
      options: [
        any,
        ...AUDIT_OUTCOMES.map((outcome) => ({
          value: outcome,
          label: labels.outcome(outcome),
        })),
      ],
    },
  ];
}
