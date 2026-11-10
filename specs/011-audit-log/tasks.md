# Tasks: Audit Log

**Input**: Design documents from `specs/011-audit-log/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/api-usage.md](contracts/api-usage.md), [contracts/screens.md](contracts/screens.md), [quickstart.md](quickstart.md), [ADR 0018](../../docs/decisions/0018-audit-search-on-press.md)

**Tests**: Required by the constitution (VIII) and the guidelines' testing table. Within a story, tests come first and must fail before the code that satisfies them is written.

**Organization**: By user story, in priority order. US1 and US2 share the filters and the entry; US1 is built with the filters present but unchecked, and US2 adds the checks and the `422` mapping. US3 adds paging, US4 links.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: The user story a task belongs to

## Rules for every task

- Check each API detail in [contracts/api-usage.md](contracts/api-usage.md) and the backend's `specs/011-audit-logs/contracts/audit.openapi.yaml`. Never invent one.
- All text goes in both `src/messages/en.json` and `src/messages/ar.json`, with identical keys.
- **`GET /audit-entries` is called only inside the handler of a person's press** (ADR 0018): Search, Older, Newer, Try again, Start again. **No `useEffect`, no query library, no cache, no prefetch, no automatic retry** may reach it.
- **One request per press**: a `busy` ref set before the request and checked first, plus disabled buttons (research R2).
- **The page's address never holds a query.** Every filter is `inAddress: false`. Nothing goes to `localStorage`, `sessionStorage`, or IndexedDB.
- **Older and Newer send the filters of the page shown**, never the form's current values, with `next_cursor` or `prev_cursor`.
- **Branch only on status and the error's field key.** Never compare message text.
- **Unknown identifiers are shown as sent**, never as a raw message key and never hidden. Translation maps use `satisfies Record<Generated, string>`.
- **Money stays a string.** Never `Number()`, `parseFloat()`, or arithmetic on an amount.
- Instants go through `Instant` with seconds, in the clinic's zone (`getEnv().CLINIC_TIMEZONE`, passed from the server).
- **Patient numbers link only through `PatientLink`** from `@/features/patients/public`. No patient's name or record is ever read by this page.
- Other features are used only through `public.ts`, except that `app/` pages may import a feature's server read.
- Response bodies are checked by Zod schemas with `satisfies z.ZodType<Generated>`.
- Names are shown as stored, with `UserText`. Logical CSS only; colors only from tokens. No `any`. Test data is synthetic.
- Tests use role queries. `getByLabel` needs `.locator("visible=true")` after a soft navigation, as hidden pages stay in the DOM.

---

## Phase 1: Setup

- [ ] T001 Confirm that `pnpm check` passes on the branch before any change, and record the observed result in this file. If anything fails, stop and report it rather than working around it
- [ ] T002 Confirm `src/lib/api/generated/audit.ts` matches the backend contract with `pnpm contracts:check`, and that it exposes `AuditEntry`, `AuditActor`, `AuditEntrySubject`, `AuditChanges`, `AuditAction` (44), `AuditOutcome`, and `AuditSubject` (9). No change is expected

---

## Phase 2: Foundational (blocks every story)

### Shared additions, each leaving existing screens unchanged

- [ ] T003 [P] Write failing tests in `src/lib/format/instant.test.ts`, then add an optional `{ seconds: true }` to `formatInstant` in `src/lib/format/instant.ts` (adds `second: "2-digit"` with the same date and time styles), and a `seconds` prop to `src/components/shared/values/instant.tsx`. Existing calls and their tests stay unchanged. Cover both locales and a time in the clinic's zone that differs from UTC's date
- [ ] T004 [P] Write failing tests in `src/lib/format/clinic-time.test.ts`, then add `minutesToClockTime(minutes: unknown): string | null` to `src/lib/format/clinic-time.ts`: a whole number 0–1440 becomes `HH:MM` (`0` → `00:00`, `540` → `09:00`, `1440` → `24:00`); anything else, including `-1`, `1441`, `9.5`, and `"540"`, is `null`
- [ ] T005 [P] Write failing tests in `src/components/shared/filter-bar.test.tsx`, then let a select option in `src/components/shared/filter-bar.tsx` carry an optional `group` label: consecutive options with the same `group` render inside one `<optgroup label>`, others as today. The `FilterDefinition` type gains `group?: string` on options only. Every existing screen's tests must pass unchanged
- [ ] T006 [P] Write failing tests in `src/components/shared/cursor-pager.test.tsx`, then create `src/components/shared/cursor-pager.tsx` per contracts/screens.md: `<nav aria-label>` with Newer then Older buttons in reading order; props `hasNewer`, `hasOlder`, `onNewer`, `onOlder`, `busy: "newer" | "older" | null`, `atNewest: boolean`; each button disabled with nothing in its direction or while `busy`, the pressed one showing progress (`aria-busy`); "Newest entries" text when `atNewest`. Labels from `shared.cursorPager.*` (`label`, `newer`, `older`, `newest`, `moving`). No total, no numbers. Test in both directions

### Audit foundations

- [ ] T007 [P] Write failing tests, then add `src/features/audit/types.ts` over `src/lib/api/generated/audit.ts`, and `src/features/audit/schemas/audit.ts` with its test: `auditEntrySchema` and `auditPageSchema` (`{ data: AuditEntry[], meta: { per_page, next_cursor: string | null, prev_cursor: string | null } }`, with no `links` or `meta.path`). `occurred_at` a string; `actor.type` one of `staff`, `system`, `unknown`; `actor.role` one of the three roles or `null`; `subject` `{ type, id }` or `null`; `changes.values[field]` `{ from: unknown, to: unknown }`; `filters` a record of `string | number` or `null`. Every schema `satisfies z.ZodType<Generated>`, except `filters`, whose generated type is `Record<string, never> | null` — record the reason beside it. Also export `AUDIT_SUBJECTS`, `AUDIT_OUTCOMES`, and `AUDIT_PAGE_SIZE = 25`
- [ ] T008 [P] Write failing tests in `src/features/audit/action-groups.test.ts`, then create `src/features/audit/action-groups.ts`: `ACTION_GROUPS`, an ordered list of `{ group, actions }` per data-model.md's "Action groups" table (`auth` 3, `staff` 5, `patients` 3, `specialties` 4, `doctors` 7, `appointments` 4, `visits` 6, `records` 6, `money` 5, `audit` 1). The test checks every generated `AuditAction` appears exactly once (44 in all), using a `satisfies Record<AuditAction, true>` list of all values
- [ ] T009 Write failing tests in `src/features/audit/describe-value.test.ts`, then create `src/features/audit/describe-value.ts`: `describeValue(subject: AuditSubject | null, field: string, value: unknown): Described`, exactly per data-model.md's `Described` type and table. Cover every row, `null` → `none`, a status for each group, `is_active` `true` and `false`, money `"200.00"` kept as the same string, `fee` on `doctor`, `date` `"2026-11-05"`, `start_minute` `540` → `09:00`, a mismatched type (`fee: 200` → `asSent "200"`), a non-scalar (`asSent` with its JSON), and an unknown field
- [ ] T010 [P] Write failing tests in `src/features/staff/api/staff-server.test.ts` (or the nearest existing test), then add `readAllStaff(locale)` to `src/features/staff/api/staff-server.ts`: every page of `GET /staff?per_page=100&page=N`, active and deactivated, stopping at `meta.last_page`, returning the first failure as is — the loop of `readAllDoctors` in `src/features/doctors/api/doctors-server.ts`
- [ ] T011 Write failing tests in `src/features/audit/api/audit.test.ts`, then create `src/features/audit/api/audit.ts`: `searchAuditEntries(filters: AuditFilters, cursor: string | null, locale)` through `browserApi`, sending only the set filters, `per_page=25`, and `cursor` only when given, built with `URLSearchParams`; checks the body with `auditPageSchema`. Assert nothing retries and that empty filters aren't sent
- [ ] T012 Add `audit.*` and `shared.cursorPager.*` to `src/messages/en.json` and `src/messages/ar.json`: `title`, `description`, `notice` (each search and page is recorded under your name; names are current names), the filter labels and hints (`from`, `to`, `staff`, `staffHint`, `patient`, `subjectType`, `subjectNumber`, `subjectHint`, `action`, `outcome`, `any`, `search`, `clear`), `actions.*` (44, nested exactly as the action's dots: `actions.auth.sign_in`, `actions.time_off.added`, looked up by the action as sent with `t.has` first), `actionGroups.*` (10), `outcomes.*`, `subjects.*` (9), `actors.system`, `actors.unknown`, `roleAtTime`, `fields.*` (every name in data-model.md's "Field names"), `entry.*` (`record`, `patient`, `address`, `changed`, `none`, `filtersUsed`, `noFilters`, `before`, `after`, `targetedAccount`), `states.*` (`beforeSearch`, `empty`, `outOfDate`, `moveFailed`, `positionRefused`, `startAgain`), `problems.*` (`reversed`, `needsType`, `needsNumber`, `notANumber`), and `shared.status.outcome.succeeded` and `.refused`. Arabic in the owner's terminology from earlier phases. `pnpm check:i18n` must pass
- [ ] T013 Write failing tests in `src/features/audit/labels.test.ts`, then create `src/features/audit/labels.ts`: hooks or functions that translate an action, outcome, subject, role, field name, and a `Described` status, each returning the identifier as sent when no key exists (`t.has`). Test an unknown action and field

### Fake backend

- [ ] T014 Add `GET /audit-entries` to `e2e/support/fake-clinic.mjs`: synthetic entries covering every actor type, a refused sign-in, changes with values, and an `audit.searched` with filters, more than two pages of 25; filters applied with AND (`staff_id` matching actor or `staff_member` subject); newest first; opaque `next_cursor` and `prev_cursor`; `403` for non-administrators; `422` for reversed dates, half a record, or a bad cursor, under the API's keys; and a control counter of calls, for `callsTo("audit-entries")`

**Checkpoint**: Phases 1–2 done; every existing test unchanged and passing.

---

## Phase 3: User Story 1 - Search the trail and read what happened (Priority: P1) 🎯 MVP

**Goal**: An administrator opens `/audit`, presses Search, and reads each entry in full.

**Independent test**: Search with no filters; each entry matches the API exactly; one request per press; nothing read on opening.

### Tests

- [ ] T015 [P] [US1] Write failing tests in `src/features/audit/use-audit-search.test.tsx` for `useAuditSearch`: **no request** on mount, re-render, Strict Mode's double mount, a `focus` and `visibilitychange` event, or remount from hidden (React `Activity` hidden then visible); Search makes exactly one request; two quick presses and Enter twice make one; `idle` → `reading` → `shown`; an empty page gives `shown` with no entries; a `5xx` or no answer gives `failed` and Try again makes exactly one request with the same filters; a `403` returns to `idle`, forgets the filters, and calls `router.refresh()`
- [ ] T016 [P] [US1] Write failing tests in `src/features/audit/components/audit-entry.test.tsx`: the summary (time with seconds in the clinic's zone, translated action, outcome badge with text, staff name with "role at the time"); the system and unknown actors in words; each absent detail reads "None"; changes listing translated names and, for kept values, before and after per `describeValue`, with "None" before on creation; `audit.searched` filters as label and value pairs, or "No filters"; the targeted-account note on a refused `auth.sign_in` with a staff actor; an unknown action shown as sent
- [ ] T017 [P] [US1] Write failing tests in `e2e/audit.spec.ts`: an administrator opens `/en/audit` and `/ar/audit`, sees the before-search state and the notice, and the fake records **0** calls; Search shows entries, the empty state for a filter matching nothing, and the error state with Try again after a scripted `500`; the address has no query at any point; receptionist and doctor see the forbidden state and the fake records 0 calls

### Implementation

- [ ] T018 [US1] Implement `src/features/audit/use-audit-search.ts` per data-model.md's `AuditSearchState`: state in `useState`, a `busy` ref, `search(filters)`, `retry()`; reads only in those functions; no `useEffect` calls the API. After a read, focus moves to the results region when the press replaced focus (as `usePatientSearch` does)
- [ ] T019 [P] [US1] Implement `src/features/audit/components/entry-changes.tsx` and `src/features/audit/components/searched-filters.tsx`, rendering `Described` values with `Money`, `ClinicDate`, `ClinicTime`, `StatusBadge` for a known status only (`isKnownStatus`; an unknown one exactly as sent in `LtrText`, never `StatusBadge`'s "Unknown status"), roles, active or deactivated, numbers in `LtrText`, and `asSent` as text; before and after in reading order
- [ ] T020 [US1] Add `outcome: { succeeded: "success", refused: "warning" } satisfies Record<AuditOutcome, StatusTone>` to `statusTones` in `src/components/shared/status-mapping.ts`, with a case in its tests. Then implement `src/features/audit/components/audit-entry.tsx` per contracts/screens.md "An entry", the outcome as `<StatusBadge kind="outcome">`: an `article` with a summary line and a description list, stacking below tablet width with no sideways scroll; network address in `LtrText`; record and patient numbers as text for now (links in US4)
- [ ] T021 [US1] Implement `src/features/audit/components/audit-filters.tsx` (the `FilterBar` definitions, every one `inAddress: false`, apply label "Search", reset label "Clear"; the staff select from `readAllStaff`'s result with deactivated marked, or a number field when it is `null`; the action select grouped by `ACTION_GROUPS`) and `src/features/audit/components/audit-search.tsx` (notice, filters, results region with its states per contracts/screens.md). Values pass through unchecked in this story: empty fields left out, numbers read with `toWesternDigits` and `readPositiveId`
- [ ] T022 [US1] Create `src/app/[locale]/(app)/audit/page.tsx`: `ScreenGate` with path `audit`, `PageHeader`, `readAllStaff(locale)` on the server, `ScopedMessages` with `audit`, `shared`, `roles`, and `auth`, and `AuditSearch` with the staff list and `timeZone`. Set `built: true` for `audit` in `src/lib/auth/app-routes.ts`, and update `src/lib/auth/app-routes.test.ts`
- [ ] T023 [US1] Make T015–T017 pass; run `pnpm check`

---

## Phase 4: User Story 2 - Narrow the search (Priority: P1)

**Goal**: Filters checked before sending, combined with AND, with the API's `422` on its field.

**Independent test**: Each filter alone and combined returns only matching entries; reversed dates and half a record are refused with no request.

- [ ] T024 [P] [US2] Write failing tests in `src/features/audit/read-audit-filters.test.ts`, then implement `src/features/audit/read-audit-filters.ts` per data-model.md's table: empty fields left out; `from`/`to` through `readClinicDate`, `reversed` on `to` when both are set and `to < from`; `patient_id`, `subject_id` after `toWesternDigits` through `readPositiveId`, else `notANumber`; `subject_type` without `subject_id` → `needsNumber` on `subject_id`, the reverse → `needsType` on `subject_type`; `action`, `outcome`, `subject_type` only generated values. `staff_id`, when typed because the staff list couldn't be read, through the same rule as `patient_id`. Cover Arabic digits, `0`, `-3`, `2.5`, a typed `staff_id`, and one date alone (allowed)
- [ ] T025 [US2] Write failing tests in `src/features/audit/use-audit-search.test.tsx` and `src/features/audit/components/audit-search.test.tsx`: a client problem shows on its field and makes **no request**; a `422` with `from`, `to`, `staff_id`, `patient_id`, `subject_type`, `subject_id`, `action`, or `outcome` shows on that field; any other key at form level, none dropped; changing a filter without Search makes no request and shows the out-of-date line; Clear empties every filter with no request and returns to before-search
- [ ] T026 [US2] Wire `readAuditFilters` and the field errors into `audit-search.tsx` and `use-audit-search.ts`, and the out-of-date line (form values compared with the filters shown, on change only). Add the staff hint (acted, or whose account) and the record hint
- [ ] T027 [US2] Add to `e2e/audit.spec.ts`: each filter alone and two combined return only matching entries from the fake; reversed dates and a record number alone show the problem and the fake records no new call; a scripted `422` appears on its field; the action select shows 10 groups; an unknown patient number and an unknown staff number show the ordinary empty state

---

## Phase 5: User Story 3 - Move through the results (Priority: P1)

**Goal**: Older and Newer, through `CursorPager`, with the filters shown.

**Independent test**: Forward twice, back once; pages match; each press one request; filters changed in the form don't change what Older sends.

- [ ] T028 [US3] Write failing tests in `src/features/audit/use-audit-search.test.tsx`: `older()` sends the shown filters with `next_cursor`, `newer()` with `prev_cursor`, even after the form changed; while moving, the shown page stays (`reading` with `previous`); a failed move keeps the page with `failed` and `previous`, and Try again repeats the same move once; a `422` on `cursor` gives the position-refused state, and Start again searches with the shown filters and no cursor; double presses make one request
- [ ] T029 [US3] Add `older()`, `newer()`, and `startAgain()` to `src/features/audit/use-audit-search.ts`, and render `CursorPager` in `audit-search.tsx` with `atNewest` from `prev_cursor === null`, the moving state (page dimmed, `aria-busy`), the move-failed notice, and the position-refused message, per contracts/screens.md. Focus returns to the results region after a move
- [ ] T030 [US3] Add to `e2e/audit.spec.ts`: Older twice and Newer once show the fake's pages with no repeat or gap, one call each; Newer disabled on the newest page and Older on the last; a scripted bad cursor shows Start again

---

## Phase 6: User Story 4 - Look into a related record (Priority: P2)

**Goal**: Numbers link to their records; patients through the audited link.

**Independent test**: A patient link opens the record with one opening by the click; staff, doctor, appointment, and charge numbers open their pages; back shows the same results with no request.

- [ ] T031 [P] [US4] Write failing tests in `src/features/audit/components/record-link.test.tsx`, then create `src/features/audit/components/record-link.tsx` per contracts/api-usage.md "Links out": `patient` subject and patient number through `PatientLink`; `staff_member` subject and a staff actor to `/staff/{id}`; `doctor` to `/doctors/{id}`; `appointment` to `/appointments/{id}`; `charge` to `/charges/{id}`, all with `prefetch={false}`; `specialty`, `time_off`, `visit`, `encounter` as text. Use it in `audit-entry.tsx` and update `audit-entry.test.tsx`
- [ ] T032 [US4] Add to `e2e/audit.spec.ts`: follow a staff link and go back, and a charge link and go back; the same page of results shows and the fake records no new `audit-entries` call; the patient link has no prefetch (no request on hover)

---

## Phase 7: Polish & cross-cutting

- [ ] T033 [P] Add the audit page to `e2e/accessibility.spec.ts`: before search, with results (including a refused entry and changes), empty, error, and forbidden, in both directions and both themes, with no axe violations
- [ ] T034 [P] Add `auditAdmin`, a second administrator, to `e2e/live/setup.ts` and `LiveAccounts` in `e2e/live/support.ts` (research R10). Create `e2e/live/audit.spec.ts` per quickstart's live journey: signed in as `auditAdmin`, count `audit.searched` by `auditAdmin` with `adminToken()` after each step and expect the table's cumulative counts; check the newest entry's `filters` match what was sent; search by a patient of a synthetic booking and see only their entries; receptionist and doctor refused; after signing out and back in, the audit log opens empty with no request (FR-004); the patient number and filter values in no address visited, in no browser storage, and not in `.next/e2e-app-server.log`
- [ ] T035 [P] Run `pnpm check:i18n`, and read the Arabic for the notice, states, actions, and field names with the owner's terminology from earlier phases
- [ ] T036 Update the documents in plan's "Documents to Update": `docs/architecture.md`, `docs/decisions/0012-audited-reads-in-the-browser.md` (a link forward to 0018), `docs/backend-integration.md` (what the live suite confirmed), `docs/frontend-blueprint.md`, `docs/development-guidelines.md`, and `docs/roadmap.md` (Phase 11 status)
- [ ] T037 Run `pnpm check` and `pnpm test:e2e:live`, and record the observed results in this file. Report a failure rather than weakening a test
- [ ] T038 Run `/code-review` on the phase's changes, fix what's confirmed, re-run T037's checks, and record the result. Left for the owner by hand: SC-001's timing and a screen reader through one search

---

## Dependencies and order

```text
Phase 1 → Phase 2 (shared additions T003–T006, then audit foundations, fake) 
                     │
                     ▼
              US1 (search, entries) 🎯
                     │
                     ▼
              US2 (filters checked)
                     │
           ┌─────────┴─────────┐
           ▼                   ▼
     US3 (paging)        US4 (links)
           └─────────┬─────────┘
                     ▼
                  Polish
```

- **US1 first**: every other story extends its hook and screen.
- **US2 before US3**: paging relies on the filters as sent, which US2 makes exact.
- **US3 and US4** touch different files except `e2e/audit.spec.ts` and `audit-entry.tsx`, so their components can be built alongside each other, with those two files edited one after another.
- **The smallest useful slice**: Phases 1 to 3.

## Parallel examples

- Phase 2: T003, T004, T005, T006, T007, T008, and T010 alongside each other; T009 after T004; T011 after T007; T013 after T012.
- US1: T015, T016, and T017 alongside each other; then T019 alongside T018.
- US2: T024 alongside T025's tests.
- After US2: T028 alongside T031.
- Polish: T033, T034, and T035.

## Implementation strategy

1. Finish Phases 1 and 2, confirming at the checkpoint that every existing screen behaves as before. Stop and report if it can't.
2. Build US1 for the MVP, running `pnpm check` at the end.
3. Add US2, US3, and US4, running `pnpm check` after each.
4. Run the live suite and review only once all stories are in.
