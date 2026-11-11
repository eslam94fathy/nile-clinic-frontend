import type { FilterValues } from "@/components/shared/filter-bar";
import { readPositiveId } from "@/lib/api/read-positive-id";
import { readClinicDate } from "@/lib/format/clinic-date";
import { toWesternDigits } from "@/lib/format/digits";
import { isAuditAction } from "./action-groups";
import {
  AUDIT_FILTER_NAMES,
  type AuditFilterName,
  type AuditFilters,
  isAuditOutcome,
  isAuditSubject,
} from "./types";

export type FilterProblem =
  "reversed" | "needsType" | "needsNumber" | "notANumber";

export type FilterReading =
  | { ok: true; filters: AuditFilters }
  | { ok: false; problems: Partial<Record<AuditFilterName, FilterProblem>> };

const textOf = (values: FilterValues, name: AuditFilterName) =>
  toWesternDigits(values[name] ?? "").trim();

/**
 * The form's values as the filters to send, or the problems the API would refuse. Only for faster feedback: the
 * API's answer decides. Nothing with a problem is sent, so it writes no `audit.searched` entry (research R9).
 */
export function readAuditFilters(values: FilterValues): FilterReading {
  const filters: AuditFilters = {};
  const problems: Partial<Record<AuditFilterName, FilterProblem>> = {};

  const from = readClinicDate(textOf(values, "from"));
  const to = readClinicDate(textOf(values, "to"));
  if (from !== null) filters.from = from;
  if (to !== null) filters.to = to;
  // Clinic dates in `Y-m-d` sort as text, so no `Date` can shift either one.
  if (from !== null && to !== null && to < from) problems.to = "reversed";

  for (const name of ["staff_id", "patient_id", "subject_id"] as const) {
    const text = textOf(values, name);
    if (text === "") continue;
    const id = readPositiveId(text);
    if (id === null) problems[name] = "notANumber";
    else filters[name] = id;
  }

  const subjectType = textOf(values, "subject_type");
  if (isAuditSubject(subjectType)) filters.subject_type = subjectType;
  const hasNumber = textOf(values, "subject_id") !== "";
  if (filters.subject_type && !hasNumber) problems.subject_id = "needsNumber";
  if (!filters.subject_type && hasNumber) problems.subject_type = "needsType";

  const action = textOf(values, "action");
  if (isAuditAction(action)) filters.action = action;
  const outcome = textOf(values, "outcome");
  if (isAuditOutcome(outcome)) filters.outcome = outcome;

  return Object.keys(problems).length > 0
    ? { ok: false, problems }
    : { ok: true, filters };
}

/** Whether two sets of filters ask the same question, for saying the results shown are the previous search's. */
export function sameFilters(a: AuditFilters, b: AuditFilters): boolean {
  return AUDIT_FILTER_NAMES.every((name) => a[name] === b[name]);
}
