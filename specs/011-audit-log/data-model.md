# Data Model: Audit Log

**Feature**: 011-audit-log | **Date**: 2026-11-10

Frontend shapes only. Every API shape comes from `src/lib/api/generated/audit.ts`; schemas `satisfies z.ZodType<Generated>`.

## From the API

| Type | Source | Notes |
|---|---|---|
| `AuditEntry` | `components["schemas"]["AuditEntry"]` | `filters` is generated as `Record<string, never> \| null`; the schema reads it as a record of `string \| number` values, the only types the backend writes (research, Facts) |
| `AuditActor`, `AuditEntrySubject`, `AuditChanges` | Generated | `values[field].from` and `.to` are `unknown`; read only by `describeValue` (below) |
| `AuditAction` (44), `AuditOutcome`, `AuditSubject` (9) | Generated enums | Translation maps use `satisfies Record<…, string>`, so an added value fails type checking |
| `AuditPage` | `{ data: AuditEntry[]; meta: { per_page: number; next_cursor: string \| null; prev_cursor: string \| null } }` | `links` and `meta.path` are removed by the same-origin route and aren't in the schema |

## The search's own state (memory only)

```ts
type AuditFilters = {        // As sent; every key optional, absent when empty
  from?: string;             // Y-m-d
  to?: string;
  staff_id?: number;
  patient_id?: number;
  subject_type?: AuditSubject;
  subject_id?: number;
  action?: AuditAction;
  outcome?: AuditOutcome;
};

type AuditSearchState =
  | { kind: "idle" }                                         // Before any search (clarification 2)
  | { kind: "reading"; previous: Shown | null; move: Move }  // `previous` is kept for a page move
  | { kind: "failed"; error: ApiError; previous: Shown | null; move: Move }
  | { kind: "shown"; shown: Shown };

type Move = "search" | "older" | "newer";

type Shown = {
  filters: AuditFilters;     // What this page was read with; Older and Newer reuse it
  page: AuditPage;
  newest: boolean;           // No prev_cursor
};
```

- Held in the search component with `useState`, plus a `busy` ref (research R2). Never in the address, storage, or a cache.
- A `403` returns to `idle` and forgets `filters`. Any other failure keeps `previous`.
- `stale`: whether the form's current values differ from `shown.filters`, to mark the results as the previous search's (US2.7). Computed
  from the form's values on change; nothing reads.

## Turning form values into filters

`readAuditFilters(values: FilterValues): { filters: AuditFilters } | { problems: Partial<Record<keyof AuditFilters, Problem>> }`

| Field | Rule (faster feedback only) | Problem |
|---|---|---|
| `from`, `to` | Real clinic dates or empty; `to` not before `from` when both | `reversed` on `to` |
| `staff_id` | A staff account's number from the choice, or empty; when the list couldn't be read and it's typed, a positive whole number after `toWesternDigits` | `notANumber` |
| `patient_id`, `subject_id` | Empty, or a positive whole number after `toWesternDigits` | `notANumber` |
| `subject_type`, `subject_id` | Both or neither | `needsType` on `subject_type`, `needsNumber` on `subject_id` |
| `action`, `outcome`, `subject_type` | One of the generated values, or empty | — (a select can't send anything else) |

## Showing values

`describeValue(subject: AuditSubject | null, field: string, value: unknown): Described`

```ts
type Described =
  | { kind: "none" }                          // null
  | { kind: "status"; group: "appointment" | "queue" | "record" | "charge"; value: string }
  | { kind: "role"; value: string }
  | { kind: "active"; value: boolean }
  | { kind: "money"; value: string }          // as sent, never parsed
  | { kind: "date"; value: string }
  | { kind: "time"; value: string }           // from minutes
  | { kind: "number"; value: number }
  | { kind: "asSent"; value: string };        // anything else, as text (JSON for a non-scalar)
```

| Subject | Field | Kind |
|---|---|---|
| `appointment` | `status` | status `appointment` |
| `visit` | `status` | status `queue` |
| `encounter` | `status` | status `record` |
| `charge` | `status` | status `charge` |
| `staff_member` | `role` | role |
| `staff_member`, `specialty` | `is_active` | active |
| `charge` | `fee`, `discount`, `amount_paid` | money, if a string |
| `doctor` | `fee` | money, if a string |
| `appointment` | `date` | date, if a clinic date |
| `appointment` | `start_minute`, `end_minute` | time, if a whole number 0–1440 |
| `appointment`, `visit` | `doctor_id` | number |
| any | anything else, or a type that doesn't match | asSent |

A status value with no translation is shown exactly as sent, in `LtrText`. `StatusBadge` is used only for a known status, as its own
unknown case shows "Unknown status", which FR-012 doesn't allow here.

## Field names

`audit.fields.<name>` for: `name`, `email`, `password`, `role`, `is_active`, `name_en`, `name_ar`, `user_id`, `title`, `registration_number`,
`specialty_ids`, `appointment_minutes`, `periods`, `start_date`, `end_date`, `start_minute`, `end_minute`, `reason`, `full_name`,
`date_of_birth`, `sex`, `phone`, `national_id`, `address`, `emergency_contact_name`, `emergency_contact_relationship`,
`emergency_contact_phone`, `patient_id`, `doctor_id`, `date`, `status`, `note`, `cancellation_reason`, `queue_entry_id`, `appointment_id`,
`queue_number`, `order_minute`, `chief_complaint`, `examination_findings`, `diagnosis`, `treatment_plan`, `prescriptions`, `text`, `fee`,
`discount`, `amount_paid`, `discount_reason`, `cancel_reason`. Any other name is shown as sent.

## Action groups

| Group (`audit.actionGroups.*`) | Actions |
|---|---|
| `auth` | `auth.*` (3) |
| `staff` | `staff.*` (5) |
| `patients` | `patient.*` (3) |
| `specialties` | `specialty.*` (4) |
| `doctors` | `doctor.*`, `schedule.*`, `time_off.*`, `fee.set` (7) |
| `appointments` | `appointment.*` (4) |
| `visits` | `visit.*` (6) |
| `records` | `encounter.*` (6) |
| `money` | `charge.*`, `payment.recorded`, `refund.recorded`, `discount.set` (5) |
| `audit` | `audit.searched` (1) |

44 in all, each once; a unit test checks it against the generated type's values.
