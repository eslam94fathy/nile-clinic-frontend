# Research: Audit Log

**Feature**: 011-audit-log | **Date**: 2026-11-10

## Facts, checked in the backend

From `specs/011-audit-logs/contracts/audit.openapi.yaml`, `data-model.md`, `research.md`, and `app/Modules/Audit` at commit `dff2dca`.

- **One operation**: `GET /audit-entries`, administrators only. Authorization runs before validation, so others get `403` whatever they send.
- **Filters**: `from`, `to` (clinic dates, `Y-m-d`, `to` not before `from`, no maximum length), `staff_id`, `patient_id`, `subject_type`
  with `subject_id` (each required with the other), `action` (44 values), `outcome`. All optional, combined with AND. `per_page` 1–100,
  default 15. `cursor` is opaque.
- **The cursor encodes a position only.** `cursorPaginate(...)->withQueryString()` orders by `id` descending; the filters are read from
  the query each time. So every page request must send the same filters again with the cursor. A cursor that doesn't decode is `422` under
  `cursor` (`audit::messages.invalid_cursor`), not a `500`.
- **`staff_id`** matches `actor_id`, or a `staff_member` subject with that id: both "who acted" and "whose account".
- **Each request writes `audit.searched`**, after its results are read, with the validated filters (ids as integers) in `filters`. So a search
  never lists itself, and the next search lists it. A refused request (`403`, `422`) writes nothing, since validation and authorization come
  first.
- **Unknown ids** give an empty page, not an error.
- **Response**: `data`, `links`, and `meta` with `path`, `per_page`, `next_cursor`, `prev_cursor`. The same-origin route already removes
  `links` and `meta.path`, which hold the private address (`stripPageLinks`); the two cursors pass through.
- **Entry**: `id`, `occurred_at` (UTC, `…000000Z`), `action`, `outcome`, `actor` (`type` staff, system, or unknown; `id`, `name` (current),
  `role` (at the time), all null unless staff), `subject` (`type`, `id`, or null), `patient_id`, `network_address`, `changes` (`fields`,
  `values`, or null), `filters` (object or null).
- **Values** (`AuditChanges`): kept only for `staff_member` `role`, `is_active`; `specialty` `is_active`; `appointment` `status`, `date`,
  `start_minute`, `end_minute`, `doctor_id`; `visit` `status`, `doctor_id`; `encounter` `status`; `charge` `status`, `fee`, `discount`,
  `amount_paid`; `doctor` `fee` (set by `fee.set`, with `from` null for a first fee). Enums arrive as their values, dates as `Y-m-d`,
  minutes as integers, money as `decimal:2` strings, `is_active` as a boolean, ids as integers. `from` is null on creation.
- **Field names** are the changed attributes, without `id`, `*_at`, `*_by`, and derived flags, plus `specialty_ids`, `periods`, `password`,
  and `text` where services add them. Patient fields (`full_name`, `phone`, …) and clinical fields (`diagnosis`, …) appear as names only.
- **Subject ids**: `doctor` is the doctor profile's id (`DoctorService`, `FeeService`, `ScheduleService`), so it matches `/doctors/{id}`.
  `staff_member` is the account id, matching `/staff/{id}`. `visit` is the queue entry. `encounter` has no administrator page.
- **No rate limit** on the route.

## R1 — How a search is read

- **Decision**: In the browser, through `browserApi` and the same-origin route, **only inside the handler of a person's press**: Search,
  Older, Newer, or Try again. No effect, no query library, no cache. The results, the filters sent, and the cursors are held in the search
  component's state, in memory only.
- **Rationale**:
  - Each read writes a permanent entry, so it must be the direct result of a person's action (constitution II, ADR 0005).
  - Phase 8 found the safest audited read is one run "directly in a click's handler, so nothing can repeat it" (architecture, medical
    records). The guarded `useAuditedRead` exists for reads that start when a record is *opened*; a search is never started by opening, so
    it needs no effect, no mark, and no ref.
  - Cache Components keeps the page mounted while hidden and re-runs effects when shown (ADR 0006). With no effect that reads, being shown
    again can't search; it keeps state, so back from a linked page restores the results (FR-017).
  - A server read would need the filters in the address, which the clarification excludes, and a refresh would repeat it.
- **Alternatives**: `useAuditedRead` (made for openings by id, and its effect is the risk this avoids). TanStack Query with every
  refetch off (nothing for it to do; ADR 0012 already rejected it for audited reads). A Server Component (needs the address).

## R2 — One read per press

- **Decision**: The press handler returns at once if a read is running (a ref, set before the request), and the buttons show progress and
  are disabled while it runs. The newest-request counter used by `usePatientSearch` discards nothing here, since a second read can't start.
- **Rationale**: Disabling alone leaves a window before React re-renders, in which a fast double press or Enter twice could send two
  requests and write two entries (FR-005).

## R3 — Paging with cursors

- **Decision**: The hook remembers the filters of the last search as sent. Older sends them with `next_cursor`, Newer with `prev_cursor`.
  Search sends new filters with no cursor. `per_page=25` on every request.
- A shared `CursorPager` in `components/shared` takes `hasOlder`, `hasNewer`, `onOlder`, `onNewer`, `busy`, and labels from
  `shared.cursorPager`. It shows no total. It says "Newest entries" when there's no `prev_cursor`, and nothing about position otherwise.
- **Rationale**: The API gives no total (contract), and pages stay stable as entries are added, because the cursor is an id. Changing a
  filter without pressing Search must not change what Older sends (US2.7), so paging uses the filters as sent, not the form's.
- **Page size**: 25, a fixed value inside the API's 100. Fewer requests than 15 per investigation, so fewer `audit.searched` entries, while
  each page stays readable. Not offered as a choice (Principle IX).
- **Alternatives**: Page numbers (the API has none). "Load more" appending (a longer page in memory, and every press is still an entry;
  next and previous is what the roadmap and blueprint set).

## R4 — After a failure

- **Decision**:
  - `401`: `browserApi` ends the session, as everywhere. The page is a signed-in page that writes on reading, so the return path skips it
    (`opensAuditedRecord` in `return-address.ts` already lists `audit`); in any case it doesn't search on opening.
  - `403`: clear the results and the last filters, and `router.refresh()` so the gate and navigation re-decide, as patient search does.
  - `422` with field keys: show each on its filter (`from`, `to`, `staff_id`, `patient_id`, `subject_type`, `subject_id`, `action`,
    `outcome`); `cursor` on the pager with a "Start again from the newest" action, which is a new search with the last filters; any other key
    at form level. Never matched by message text.
  - No answer, `5xx`: on Search, the error state with Try again (one read of the same request). On Older or Newer, keep the page shown, with a
    notice that it didn't move and Try again.
- **Rationale**: FR-002, FR-018, FR-019. Retrying is always a person's press (constitution II).

## R5 — Showing an entry

- **Decision**: A list of entries, one `article` each, not a table. Each has a summary line (time, action, outcome, actor) and a description
  list (record, patient, address, changes, filters). Below tablet width it stacks; nothing scrolls sideways.
- **Time**: `formatInstant` gains an option for seconds, used here only: entries a second apart must be distinguishable.
- **Translations**: `audit.actions.*` (44, grouped under `audit.actionGroups.*` for the choice), `audit.outcomes.*`, `audit.subjects.*`,
  `audit.actors.system`, `audit.actors.unknown`, roles from `roles.*`, and `audit.fields.*` for every field name listed in Facts. An
  identifier with no key is shown as sent, in `LtrText`, so a backend addition never breaks the page or shows a raw key (FR-012).
- **Values**, by record type and field, in one tested function:
  - `status`: `shared.status.appointment` (appointment), `.queue` (visit), `.record` (encounter), `.charge` (charge).
  - `role`: `roles.*`. `is_active`: `shared.status.activity.active` or `.deactivated`.
  - `fee`, `discount`, `amount_paid`: `Money`, the string as sent.
  - `date`: `ClinicDate`. `start_minute`, `end_minute`: a clock time from minutes after midnight, through a new `minutesToClockTime` in
    `lib/format/clinic-time.ts` (`540` → `09:00`, `1440` → `24:00`), shown with `ClinicTime`; out of range is shown as sent.
  - `doctor_id`: the number.
  - `null`: "None". Anything else, or a type that doesn't match: shown as sent, as text.
- **Search filters** (`audit.searched`): label and value pairs, using the filter labels, with action, outcome, and record type translated.
- **Rationale**: Each entry has up to ten parts of uneven length, and changes are a nested list; rows of a table can't hold that readably in
  both directions.

## R6 — Links

- **Decision**: Patient numbers use `PatientLink` (the audited link, `prefetch={false}`, marks the opening as asked). A `staff_member` subject
  and a staff actor link to `/staff/{id}`; a `doctor` subject to `/doctors/{id}`; an `appointment` to `/appointments/{id}`; a `charge` to
  `/charges/{id}`. These four aren't audited, so they're ordinary links. `patient` subjects also use `PatientLink`. Others are text.
- **Rationale**: Clarification 3. Those pages exist for administrators (checked in `src/app`). `PatientLink` is already exported by
  `features/patients/public.ts`.

## R7 — The staff choice

- **Decision**: Read on the server, all pages of `GET /staff?per_page=100`, active and deactivated, through a new `readAllStaff` beside
  `readStaffList`, the same loop as `readAllDoctors`. Names as stored, deactivated ones marked. If it fails, the staff choice falls back to a
  number field, and the page still works.
- **Rationale**: Not audited, already read on the server by Phase 4 (ADR 0011). A staff member's number alone is hard to know.

## R8 — The action choice

- **Decision**: `FilterBar`'s select gains optional groups, rendered as `optgroup`, so the 44 actions are grouped by area. The groups and
  their order are a constant in the audit feature, checked against the generated `AuditAction` type with `satisfies`, so an action added to
  the contract fails type checking until it is placed.
- **Rationale**: A flat list of 44 is hard to scan. `optgroup` works with the native select the design system uses (ADR 0007).

## R9 — Client checks

- **Decision**: Before sending: `to` before `from` (two dates read with `readClinicDate` and compared as `Y-m-d` strings; `readDateRange`
  doesn't fit, as it needs a default range and a maximum, and the trail allows one date alone), exactly one of record type and number, and
  numbers that aren't positive whole numbers (`readPositiveId`, after `toWesternDigits`, so Arabic digits work). Problems appear on the field,
  and nothing is sent, so no entry is written. The API's `422` still decides.

## R10 — How the live suite counts entries

- **Decision**: Setup creates a second administrator, `auditAdmin`, which the browser signs in as. The test counts with the setup
  administrator's token, `GET /audit-entries?staff_id=<auditAdmin>&action=audit.searched&per_page=100`. The counting searches are
  the setup administrator's, so they never match.
- **Rationale**: A count is itself a search. Separating who searches from who counts keeps every count exact.
