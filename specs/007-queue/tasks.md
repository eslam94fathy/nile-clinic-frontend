# Tasks: Queue

**Input**: Design documents from `specs/007-queue/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/api-usage.md](contracts/api-usage.md), [contracts/screens.md](contracts/screens.md), [quickstart.md](quickstart.md), [ADR 0013](../../docs/decisions/0013-live-reads.md)

**Tests**: Required by the constitution (VIII) and the guidelines' testing table. Within a story, tests come first and must fail before the code that satisfies them is written.

**Organization**: By user story, in dependency order rather than number order, following the plan. The hidden-page measurement comes first, because everything rests on it. Then access (US7), because every page needs its gate. Then reception's list (US2) with staying current (US3), which are built together, check-in (US1), corrections (US6), the doctor's list (US4), and walk-ins (US5).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: The user story a task belongs to

## Rules for every task

- Check each API detail in [contracts/api-usage.md](contracts/api-usage.md) and `contracts/queues.openapi.yaml`. Never invent one.
- All text goes in both `src/messages/en.json` and `src/messages/ar.json`, with identical keys.
- **Only the three queue reads may use the `live` policy** (ADR 0013). Nothing audited ever polls.
- **Never call `GET /patients/{id}` to show someone in the queue or the walk-in form.** Links to a record use only `PatientLink`. Every other link uses `prefetch={false}`.
- **Search terms stay in component state.** Never in an address, title, log, or browser storage. Patients and doctors appear in addresses only as numbers.
- **Branch only on status, the error's key, and `reason`.** Never compare message text.
- **Appointment times and dates of birth are shown as sent.** Instants go through `Instant`, in the clinic's zone. `end` may be `24:00`.
- **A queue number is never presented as a position,** and the API's order is never re-sorted.
- **Actions are never repeated automatically.**
- **Other features are used only through `public.ts`**, except that `app/` pages may import a feature's server read.
- Response bodies are checked by Zod schemas with `satisfies z.ZodType<Generated>`.
- Logical CSS only. No `any`. Test data is synthetic, including anything typed by hand.
- Tests use role queries. `getByLabel` needs `.locator("visible=true")` after a soft navigation, as hidden pages stay in the DOM.

---

## Phase 1: Setup

- [X] T001 Confirm that `pnpm check` passes on the branch before any change, and record the result in this file. **Observed on 2026-11-07, before any change:** typecheck, lint, format, i18n, styles, contrast, and contracts passed; e2e 707 passed. Unit tests: 1 of 1208 failed on the first run, `doctor-chooser.test.tsx`, "moves focus to the results", then 3 of 3 full runs and 5 of 5 runs of that file passed. It looks like a timing flake under load, though the cause isn't confirmed. The test wasn't changed
- [X] T002 Add `@tanstack/react-query` at exactly 5.106.1 with `pnpm add --save-exact`, and move it from Planned to in use in `docs/tech-stack.md`, with its reason and version. Confirm `pnpm check` still passes

---

## Phase 2: Foundational (blocks every story)

### Queue logic

- [X] T003 [P] Write failing tests, then add `src/features/queue/types.ts` over `src/lib/api/generated/queues.ts`, and `src/features/queue/schemas/queue.ts` with `schemas/queue.test.ts`: response schemas for `QueueEntry` and `OwnQueueEntry`, using `satisfies z.ZodType<Generated>`, and for `GET /queue`'s page with `meta`, following `src/lib/api/pagination.ts`. `appointment` and the three optional instants may be null. Reject a `status` outside `waiting`, `with_doctor`, `seen`, `left` (data-model)
- [X] T004 [P] Write failing tests, then implement `src/features/queue/read-queue-filters.ts` with its test: `doctor_id` through `readPositiveId`, `status` only if one of the four values, `page` only if a positive whole number and no doctor is chosen. Anything else is ignored, and nothing throws (data-model, research R6)
- [X] T005 [P] Write failing tests, then implement `src/features/queue/group-by-doctor.ts` with its test: groups adjacent rows by `doctor.id`, keeping the API's order, and never sorts. Cover an empty list, one doctor, and a doctor appearing twice apart, which stays two groups (research R6)
- [X] T006 [P] Write failing tests, then implement `src/features/queue/offered-entry-actions.ts` with its test: `waiting` from an appointment gives `mark_left` and `undo`; a `waiting` walk-in gives `mark_left`; `with_doctor`, `seen`, and `left` give nothing (FR-030, research R7)
- [X] T007 [P] Write failing tests, then implement `src/features/queue/offered-own-action.ts` with its test: `finish` if any row is `with_doctor`, otherwise `call_next` if any is `waiting`, otherwise `null` (FR-022, research R7)
- [X] T008 [P] Write failing tests, then implement `src/features/queue/apply-entry.ts` with its test: replaces the row with the same `id`, leaves other rows and their order alone, and returns the list unchanged if no row matches (research R4)

### Shared code, each with its consumer in this phase

- [X] T009 Write failing tests in `src/lib/api/refusal.test.ts`, then move `isOutcomeUnknown` and `allMessages` from `src/features/appointments/refusal.ts` to `src/lib/api/refusal.ts`, updating every import. `isAboutTheTime` stays. Existing appointment tests must pass unchanged (plan, Structure Decision)
- [X] T010 [P] Write failing tests in `src/components/shared/confirm-dialog.test.tsx`, then make `trigger` optional in `src/components/shared/confirm-dialog.tsx`, rendering no `AlertDialogTrigger` when it's left out. Existing behaviour stays unchanged when it's given (research R5)
- [X] T011 [P] Write failing tests, then add `src/lib/api/live-query.ts` with its test, holding the `live` policy exactly as in data-model: `staleTime` 0, `refetchInterval` 15000, `refetchIntervalInBackground` false, `networkMode` "always", and one retry for status `0` or `5xx` and never for `4xx`. Its comment names ADR 0013, and says audited reads must never use it

### API module

- [X] T012 Write failing tests, then implement `src/features/queue/api/queue.ts` with `queue.test.ts`, through `browserApi`: `readClinicQueue(filters, locale)`, always sending `per_page=100`; `readDoctorQueue(id, locale)`; `readOwnQueue(locale)`; `checkInAppointment(id, locale)`; `addWalkIn(body, locale)`; `markLeft(id, locale)`; `undoCheckIn(id, locale)`, handling the `204`; `callNext(locale)`; and `finishVisit(locale)`. Actions send no entry id for a doctor, and are never retried. Export `checkInAppointment` and its entry type from `src/features/queue/public.ts`

### Fake backend

- [X] T013 Extend `e2e/support/fake-clinic.mjs` with the queue, following its existing style: all nine operations in contracts/api-usage.md. Check-in moves an appointment to `checked_in`, undo moves it back, and finish moves it to `completed`. Numbers are never reused. It answers `422` under `appointment`, `patient_id`, `entry`, and `queue`, and `409` with `already_checked_in` and `patient_with_another_doctor`. A test can seed entries, make reads fail with a chosen status, change a row between reads, and read a count of `GET /queue`, `GET /doctors/{id}/queue`, `GET /doctors/me/queue`, and `GET /patients/{id}`
- [X] T014 Add dedicated synthetic doctors to `e2e/live/setup.ts`, with their accounts in the `LiveAccounts` type in `e2e/live/support.ts`, and deactivated by teardown as the others are: `queueDoctor` and `secondQueueDoctor`, with hours on all seven days, so that appointments can be booked today whatever day the suite runs

---

## Phase 3: The hidden-page measurement (blocks everything that polls)

**Purpose**: Measure the one assumption not yet known (research R2) before anything depends on it.

- [X] T015 Write the hook and provider as far as this needs: `src/features/queue/hooks/use-live-list.ts` over `useQuery<T, ApiError>` with the `live` policy, and `src/features/queue/components/live-query-provider.tsx`, with the client in `useState`. `browserApi` returns a result rather than throwing, so the query function throws the failed result's `ApiError`, with no `any`. Keep them inside `/queue`'s real page with a bare list, wrapped in `<Suspense>`, **behind `ScreenGate` from the start**, and set `built: true` for `queue` in `src/lib/auth/app-routes.ts`
- [X] T054 Straight after T015, update what relied on `/queue` being a placeholder: in `e2e/appointments.spec.ts`, "later phases' placeholders are unchanged" moves to `/en/billing`. Then run `session-end`, `token-absence`, `auth`, and `navigation` specs against the real pages, as they use `/en/queue` and `/en/my/queue` as ordinary signed-in addresses, and give the fake backend whatever they now read. Don't weaken any of them. Added by `/speckit-analyze`, so its number is out of sequence: it runs here. **Result**: the owner ran `pnpm check` and reported that it passed (2026-11-07); counts not recorded
- [X] T016 Write `e2e/queue.spec.ts`'s first test against the production build, using one real interval: count `GET /queue` while visible; move to `/appointments` by a link in the application and wait past an interval, confirming no reads and that the page is still in the DOM; come back, confirming one read at once. Repeat by hiding the tab, using an emulated `visibilityState` or a second page brought to front. Record what was measured in research R2
- [X] T017 If T016 shows reads on a hidden page, apply the stated fallback in `use-live-list.ts`, a `useLayoutEffect` flag driving `enabled`, and re-run T016. **Either way, update ADR 0013's "Unmeasured" section with the result.** If neither works, stop and report it to the owner

---

## Phase 4: User Story 7 - Roles and refusals (Priority: P1)

**Goal**: Every queue page has its gate, and the API's answer wins.

**Independent Test**: Each role against every queue page and action, plus a refusal forced during a refresh.

- [X] T018 [US7] Add page shells with `ScreenGate`, `Suspense`, `PageHeader`, and `ScopedMessages`, following `src/app/[locale]/(app)/appointments/new/page.tsx`: `src/app/[locale]/(app)/queue/walk-in/page.tsx` with path `queue`, and `src/app/[locale]/(app)/my/queue/page.tsx` with path `my/queue`. Set `built: true` for `my/queue` in `src/lib/auth/app-routes.ts`. Add the `queue.*` messages used so far to both language files
- [X] T019 [US7] Write failing tests in `src/features/queue/hooks/use-live-list.test.tsx`, then complete `use-live-list.ts`, per research R3: on `403` or `404` it removes the query, holds the error in its own state, and sets `enabled: false`; on `0` or `5xx` it keeps the data; it returns the data, the states, `dataUpdatedAt`, `isRefetchError`, and `refresh()`, which invalidates the root `["queue"]`. A `401` never settles, as `browserApi` ends the session
- [X] T020 [US7] Add role cases to `e2e/queue.spec.ts`, comparing every cell of the permissions table in contracts/screens.md on the fake backend: a doctor on `/queue` and `/queue/walk-in` gets "not allowed" with zero queue reads; reception on `/my/queue` gets "not allowed" with zero reads
- [X] T021 [US7] Add to `e2e/queue.spec.ts`: a `403` during a refresh gives "not allowed", no synthetic name or phone anywhere in the page's DOM, and no more reads over later intervals; a `401` during a refresh gives the sign-in redirect, with no patient number in the return address; signing out with a list on screen, then going back, shows no patient details
- [X] T022 [P] [US7] Write a failing test in `src/lib/auth/return-address.test.ts`, then confirm that `safeReturnAddress` gives `/queue/walk-in` for `/en/queue/walk-in?patient_id=12`, and `/queue` for `/en/queue?doctor_id=3&status=waiting`. No code change is expected (FR-034)

---

## Phase 5: User Story 2 - See today's queue at the desk (Priority: P1)

**Goal**: Reception sees today's list, by doctor and in the API's order, and can narrow it.

**Independent Test**: Synthetic patients with two doctors, filtered by doctor and status, with a reload and back.

- [X] T023 [US2] Write failing tests in `src/features/queue/components/queue-group.test.tsx`, then implement `queue-group.tsx`, using `DataTable`: the doctor's name above; each row's number, status with the shared badge, arrival, appointment's start and end linking to it with `prefetch={false}` or a "Walk-in" label, called, finished, or left where they exist, and patient number, name as a `PatientLink`, and phone. Names use `bdi` with `dir="auto"`, and long names wrap (FR-009, FR-010, FR-038, FR-039)
- [X] T024 [US2] Write failing tests in `src/features/queue/components/clinic-queue.test.tsx`, then implement `clinic-queue.tsx`: chooses the read per research R6's table; groups with `groupByDoctor`; filters a chosen doctor's complete list by exact status; and shows every state in contracts/screens.md. A changed filter shows loading, never the previous filter's rows. An empty page beyond the end replaces the address with `last_page` (FR-006, FR-007, FR-011)
- [X] T025 [US2] Complete `src/app/[locale]/(app)/queue/page.tsx`: gate, `readQueueFilters` from the address, `readAllDoctors` for the filter including inactive doctors, and `CLINIC_TIMEZONE` passed down. Header links to today's appointments and `/queue/walk-in`, both with `prefetch={false}`. A doctors read that failed leaves the status filter only (FR-006, FR-008, FR-012)
- [X] T026 [US2] Add to `e2e/queue.spec.ts`: the default list shows every status, grouped; each filter and both together match, surviving a reload and back; an invalid value shows the unfiltered list; a doctor who doesn't exist shows neutral not-found with a link to all doctors; both empty states; a patient's link is the only thing that counts as `GET /patients/{id}`, with zero after showing, hovering, and refreshing, and one after following it

---

## Phase 6: User Story 3 - A list that stays current (Priority: P1)

**Goal**: The list reads itself while visible, and never disturbs anyone.

**Independent Test**: See quickstart's fake backend table, using Playwright's clock.

- [X] T027 [US3] Write failing tests in `src/features/queue/components/last-read.test.tsx`, then implement `last-read.tsx`: last-read time through `Instant` in the clinic's zone, a "Refresh now" button that can't be pressed twice while reading, and the out-of-date notice with `role="status"`, shown once on failing and cleared on recovery. The list itself has no live region. Check `formatInstant`'s output suits a list changing every 15 seconds, and record what was found in research R10 (FR-016, FR-017, FR-019, research R11)
- [X] T028 [US3] Connect `last-read.tsx` in `clinic-queue.tsx`. Write a failing test, then keep focus when a refresh removes a focused row: rows are keyed by entry id, and when focus was in a row that's gone, it moves to the page's heading (US3 scenario 7, research R5)
- [X] T029 [US3] Add to `e2e/queue.spec.ts`, using `page.clock`: one read per 15 seconds while visible, with a change appearing and no loading state replacing the list; a failed refresh keeps the list with the notice, and recovery clears it; `context.setOffline(true)` shows the notice and isn't a silent pause; a first read failing shows the error state, and "Try again" works; a row disappearing while focused moves focus to the heading; and, with the page left for another in the application for 2 minutes of clock time, zero reads, then one read within a second of returning (SC-003, SC-007)

---

## Phase 7: User Story 1 - Check in an arriving patient (Priority: P1)

**Goal**: Reception checks a patient in from today's appointment.

**Independent Test**: Check in a synthetic appointment for today, and confirm the number, the new state, and the row.

- [X] T030 [US1] Write failing tests in `src/features/appointments/offered-actions.test.ts`, then add `check_in` to `offered-actions.ts`: offered first, when `scheduled` and `date` equals `clinicNow`'s date part, whether started or not, alongside Phase 6's actions. Not on another date, and not for any other status. The existing test's same-day expectation of `["no_show"]` changes on purpose to `["check_in", "no_show"]`, as FR-002 requires. A later date's clock still gives `["no_show"]`, and that existing case stays, proving other dates are unaffected (FR-001, FR-002, research R7)
- [X] T031 [US1] Write failing tests in `src/features/appointments/components/appointment-actions.test.tsx`, then add check-in to `appointment-actions.tsx`, using `checkInAppointment` from `@/features/queue/public`, with no confirmation (FR-005): progress and no double submission; on success, a toast with the API's queue number, `changed()`, and `router.refresh()`; on any refusal, `refused()` with `allMessages`, and a refresh; on an unknown outcome, `unknownOutcome()`. A `checked_in` appointment shows a link to `/queue?doctor_id=N`, with `prefetch={false}`, and offers no action (FR-003, FR-004)
- [X] T032 [US1] Add to `e2e/queue.spec.ts`: check-in offered today, and not on another date; the confirmation's number; the page's new state and link; a forced `422` and `409` at page level with the current state shown; a held Queue page showing the new row on returning; undoing from the queue makes the appointment's page scheduled again
- [X] T033 [US1] Add a note to `specs/006-appointments/spec.md` on FR-023, pointing to this spec's FR-001

---

## Phase 8: User Story 6 - Correct the list (Priority: P2)

**Goal**: Reception can mark a patient as left, or undo a check-in, without a refresh getting in the way.

**Independent Test**: Mark one as left, undo another, and change a row while its dialog is open.

- [X] T034 [US6] Write failing tests in `src/features/queue/components/entry-action-dialog.test.tsx`, then implement `entry-action-dialog.tsx`, above the groups, using `ConfirmDialog` with no trigger: holds a copy of the entry it opened for, so that its text can't change; names the patient and says what can't be undone, per contracts/screens.md, with `irreversible` for left; in-flight guard; on success, closes with a toast; on a refusal, stays open with `allMessages`; on an unknown outcome, says so; always calls `refresh()` afterwards (FR-014, FR-031, research R5, R8)
- [X] T035 [US6] Connect it in `clinic-queue.tsx`, with row buttons from `offeredEntryActions` that only say which entry and action. On closing, focus returns to the row's button if it still exists, found by a data attribute, and otherwise the heading, through `onCloseAutoFocus` (FR-030, US6 scenario 7)
- [X] T036 [US6] Add to `e2e/queue.spec.ts`: left and undo on the right rows only; each dialog's text; a dismissed dialog changing nothing, with focus back; a row changing, then disappearing, while its dialog is open, with the dialog staying, focus kept during the refresh, and the API's refusal appearing on confirming; the `entry` refusal, including `has_active_charge` through the fake backend; an unknown outcome (SC-006, SC-010)

---

## Phase 9: User Story 4 - A doctor calls next and finishes (Priority: P1)

**Goal**: The doctor moves their list with confirmed actions, and sees only what the API allows.

**Independent Test**: Two waiting patients: call, finish, and call again. No contact detail appears.

- [X] T037 [US4] Write failing tests in `src/features/queue/components/own-queue-actions.test.tsx`, then implement `own-queue-actions.tsx`, offering what `offeredOwnAction` says: "Call next", whose dialog names nobody and says a called patient can't be sent back, and "Finish visit", whose dialog names the current patient, says it can't be undone, and doesn't mention a medical record. Dialogs hold their own copy, and open on the safe choice. On success, a toast names the patient the API returned, `applyEntry` updates the list, and `refresh()` follows. On a refusal, the dialog stays open with `allMessages`, and `refresh()` follows. On an unknown outcome, it says so (FR-022, FR-023, FR-024, research R4, R8)
- [X] T038 [US4] Write failing tests in `src/features/queue/components/own-queue.test.tsx`, then implement `own-queue.tsx`: the current patient set apart, the action, `last-read.tsx`, and rows of number, status, arrival, appointment's start and end or "Walk-in", called and finished where they exist, and patient number, name, translated sex, and date of birth as sent. No links, and no reception actions. Every state in contracts/screens.md. A `404` calls `router.refresh()`, so that the gate shows "profile not set up" (FR-021, FR-024, FR-025)
- [X] T039 [US4] Complete `src/app/[locale]/(app)/my/queue/page.tsx`, with the provider, `CLINIC_TIMEZONE`, and `Suspense`
- [X] T040 [US4] Add to `e2e/queue.spec.ts`: call, finish, and call again; the patient the API returned being shown, including one that isn't the first waiting row, and when the read after it fails; each refusal under `queue`, and `409`, with the list read again; empty states that keep refreshing, so a new arrival appears by itself; no phone anywhere in the page's DOM; no links to a record; a doctor with no profile; dismissing each dialog; and leaving `/my/queue` for another page, with zero reads while away and one on returning (SC-005, FR-013)

---

## Phase 10: User Story 5 - Add a walk-in (Priority: P2)

**Goal**: Reception adds a registered patient with no appointment to a doctor's list.

**Independent Test**: Add a walk-in, confirm the row and that free times are unchanged, then add them again.

- [X] T041 [US5] Write failing tests in `src/features/queue/components/walk-in-form.test.tsx`, then implement `walk-in-form.tsx`, following `booking-form.tsx`, using `PatientChooser`, `ChosenPatient`, and `DoctorChooser` from each feature's `public.ts`, with a note before submitting that a walk-in can only be marked as left, never removed. `useFormSubmit` with fields `patient_id` and `doctor_id`, keeping what was chosen on a refusal. On success, a toast with the API's queue number, reset, and `router.push("/queue")`. On an unknown outcome, it says so, with a link to the Queue page, using `isOutcomeUnknown` (FR-026, FR-027, FR-028, FR-029)
- [X] T042 [US5] Complete `src/app/[locale]/(app)/queue/walk-in/page.tsx`: read `patient_id` as `/appointments/new` does, with `key={raw ?? "none"}`, read specialties on the server, and show `ApiFailureState` if that fails
- [X] T043 [US5] Write a failing test in `src/features/patients/components/patient-record.test.tsx`, then add "Add to today's queue" to `patient-record.tsx`, linking to `/queue/walk-in?patient_id=N` with `prefetch={false}`, causing no further read of the record, and showing nothing about the queue. Add a note to `specs/006-appointments/spec.md` on FR-024, pointing to this spec's FR-029a (FR-029a)
- [X] T044 [US5] Add to `e2e/queue.spec.ts`: adding a walk-in, with the number and label; each `422` on its field; an unknown outcome; carried from a patient's page with zero `GET /patients/{id}`; a value in the address that isn't valid; the form empty when next opened, including going back after submitting; no search term in the address, title, or browser storage; the search field asking the browser not to remember it, and Arabic digits typed in the phone or number field being sent as Western digits (FR-041)

---

## Phase 11: Polish and cross-cutting

- [X] T045 Add `/queue`, `/queue/walk-in`, and `/my/queue` to `e2e/accessibility.spec.ts`, with data, dialogs open, and the out-of-date notice showing, in both languages and directions, with both themes wherever the other screens check them. Fix what it finds (SC-012)
- [X] T046 Write `e2e/live/queue.spec.ts`, covering every row of quickstart's live table against the running API, using two browser contexts and the doctors from T014, with audit counts read through the API. Reception seeing a doctor's change and the reverse each wait for one real interval, with a 20-second limit (SC-002, SC-004, SC-013). Add a scripted several-minutes-of-refreshing check, using at least four real intervals, that confirms reading adds no audit entries. **Result** (2026-11-07): the owner's full live run gave 71 passed and 10 failed, all in this file, because `auth.spec.ts` changed the shared receptionist's password. That test now has its own account. Then `auth.spec.ts` and this file together: 28 of 28 passed in 3.9 minutes, 16 of them here
- [X] T047 Add to the live journey a search of the address history and browser storage, and of the server's logs if earlier suites do so, for every synthetic term and patient detail used (SC-008)
- [X] T048 Confirm that no key is missing from either language file, no user-facing text is hard-coded, and only logical CSS is used, using the project's existing checks
- [X] T049 [P] Update `docs/backend-integration.md` with what the live suite confirmed, only as observed, and add **gap G8**: past days' entries can't be reached, so anything open at midnight stays so
- [X] T050 [P] Update `docs/architecture.md`, with "Reading in a Client Component" as built and the queue feature, and add links from `docs/decisions/0005-audit-safe-data-fetching.md` and `0011-server-reads-and-refresh.md` to ADR 0013
- [X] T051 [P] Update `docs/frontend-blueprint.md`, with the queue pages as built, `/queue/walk-in`, and check-in on the appointment's page. Update `docs/development-guidelines.md` with how to write a live list, and that a confirmation must sit above anything a refresh can remove
- [ ] T052 Run `pnpm check` and `pnpm test:e2e:live`, record the actual results in this file and `docs/roadmap.md`'s phase line, and don't report anything not observed. Do quickstart's "By hand" checks that can be done in this environment, and list those left for the owner
- [ ] T053 Run `/code-review` on the phase's changes, fix what's confirmed, and re-run T052's checks. **So far** (2026-11-07, medium level): 10 findings. Fixed 6: a second submit after a refusal, focus lost when a refresh removes a control, focus moved for someone who had left, focus lost on choosing a doctor, an answer about someone not yet listed, and the link on a past day's check-in. Narrowed 1: finish won't send once the list shows another current patient, but a change no read has shown yet still reaches the API, which takes no entry id. Partly fixed 1: `TimeRange` is shared, and the `unwrapped` copies remain. Left 2: the doctors list read on each `/queue` render, and four similar confirm flows. After the fixes: unit tests in `features/queue`, `features/appointments`, and `lib/api` 326 of 326, typecheck, lint, format, and i18n pass, `e2e/queue.spec.ts` 66 of 66 on a production build. T052's full checks haven't been re-run

---

## Dependencies and order

```text
Phase 1 → Phase 2 → Phase 3 (measurement; must finish first)
                       │
                       ▼
                    US7 (gates) → US2 (list) → US3 (current)
                                                 │
                       ┌─────────────┬───────────┼─────────────┐
                       ▼             ▼           ▼             ▼
                     US1           US6         US4           US5
                  (check-in)  (corrections)  (doctor)     (walk-in)
                       └─────────────┴───────────┴─────────────┘
                                         │
                                         ▼
                                      Polish
```

- **US1, US6, US4, and US5** can each proceed once US3 is done, in any order. US6 changes `clinic-queue.tsx`, as US3 does, so it follows it. US1 and US5 also need nothing from each other.
- **The smallest useful slice**: Phases 1 to 7, which give check-in and a live list for reception.

## Parallel examples

- Phase 2: T003 to T008, then T010 and T011, are separate files with no dependency on each other.
- US7: T022 alongside T018 to T021.
- Polish: T049, T050, and T051.

## Implementation strategy

1. Finish Phases 1 to 3, and stop to report if the measurement can't be made to hold.
2. Build Phases 4 to 7 for a usable reception slice, running `pnpm check` at the end of each.
3. Add corrections, the doctor's list, and walk-ins, one phase at a time.
4. Run the live suite and review only once all stories are in.
