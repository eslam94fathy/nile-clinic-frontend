import type { components } from "@/lib/api/generated/audit";

type Schemas = components["schemas"];

export type AuditAction = Schemas["AuditAction"];
export type AuditOutcome = Schemas["AuditOutcome"];
export type AuditSubject = Schemas["AuditSubject"];
export type AuditActor = Schemas["AuditActor"];
export type AuditEntrySubject = Schemas["AuditEntrySubject"];
export type AuditChanges = Schemas["AuditChanges"];

/** The search's filters as recorded with `audit.searched`: identifiers as numbers, the rest as text. */
export type SearchedFilters = Record<string, string | number>;

/** Who acted, as read: a type or role the contract doesn't list yet is kept as sent (FR-012). */
export type AuditEntryActor = Omit<AuditActor, "type" | "role"> & {
  type: string;
  role: string | null;
};

/**
 * One entry, as read. Its action, outcome, record type, actor type, and role are any text, not only the contract's
 * values: one the backend adds later is shown as sent rather than failing the whole page, where each retry would
 * write another `audit.searched` entry (FR-012, research R5). Narrow with `isAuditSubject` and the like before
 * relying on a known value.
 *
 * `filters` is generated as `Record<string, never> | null`, as the contract leaves it untyped, but the backend writes
 * only the validated filters there, as text and whole numbers (`SearchAuditEntriesRequest::filters`).
 */
export type AuditEntry = Omit<
  Schemas["AuditEntry"],
  "action" | "outcome" | "actor" | "subject" | "filters"
> & {
  action: string;
  outcome: string;
  actor: AuditEntryActor;
  subject: (Omit<AuditEntrySubject, "type"> & { type: string }) | null;
  filters: SearchedFilters | null;
};

/**
 * A page of entries. The same-origin route removes `links` and `meta.path`, which hold the API's private address.
 * There is no total: the cursors are the only way to move.
 */
export type AuditPage = {
  data: AuditEntry[];
  meta: {
    per_page: number;
    next_cursor: string | null;
    prev_cursor: string | null;
  };
};

/** The filters as sent: each one absent when empty. */
export type AuditFilters = {
  from?: string;
  to?: string;
  staff_id?: number;
  patient_id?: number;
  subject_type?: AuditSubject;
  subject_id?: number;
  action?: AuditAction;
  outcome?: AuditOutcome;
};

export type AuditFilterName = keyof AuditFilters;

/** Every name the API knows for the filters, in the order the form shows them. */
export const AUDIT_FILTER_NAMES = [
  "from",
  "to",
  "staff_id",
  "patient_id",
  "subject_type",
  "subject_id",
  "action",
  "outcome",
] as const satisfies readonly AuditFilterName[];

// `satisfies Record<…, true>` makes each list exhaustive: a value added to the contract fails type checking here.
const SUBJECTS = {
  staff_member: true,
  patient: true,
  specialty: true,
  doctor: true,
  time_off: true,
  appointment: true,
  visit: true,
  encounter: true,
  charge: true,
} satisfies Record<AuditSubject, true>;

const OUTCOMES = { succeeded: true, refused: true } satisfies Record<
  AuditOutcome,
  true
>;

export const isAuditSubject = (value: unknown): value is AuditSubject =>
  typeof value === "string" && Object.hasOwn(SUBJECTS, value);
export const isAuditOutcome = (value: unknown): value is AuditOutcome =>
  typeof value === "string" && Object.hasOwn(OUTCOMES, value);

/** In the contract's order, for the choices. */
export const AUDIT_SUBJECTS: AuditSubject[] =
  Object.keys(SUBJECTS).filter(isAuditSubject);
export const AUDIT_OUTCOMES: AuditOutcome[] =
  Object.keys(OUTCOMES).filter(isAuditOutcome);

/** A fixed size within the API's 100: fewer presses, and so fewer `audit.searched` entries, than its 15 (research R3). */
export const AUDIT_PAGE_SIZE = 25;
