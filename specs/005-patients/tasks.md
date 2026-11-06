# Tasks: Patients

**Input**: Design documents from `specs/005-patients/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/api-usage.md](contracts/api-usage.md), [contracts/screens.md](contracts/screens.md), [quickstart.md](quickstart.md)

**Tests**: Required by the constitution (VIII) and the guidelines' testing table. Within a story, tests come first and must fail before the code that satisfies them is written.

**Organization**: By user story, in dependency order rather than number order, following the plan. Access (US5) comes first, because every page needs its gate. The record page (US3) comes next, because it's the audited core and search results link to it. Then search (US1), register (US2), and edit (US4).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: The user story a task belongs to

## Rules for every task

- Check each API detail in [contracts/api-usage.md](contracts/api-usage.md) and the snapshot in `contracts/patients.openapi.yaml`. Never invent one.
- All text goes in both `src/messages/en.json` and `src/messages/ar.json`, with identical keys.
- **No patient read on the server.** There is no `*-server.ts` in this feature. All patient calls use `browserApi`, only inside `src/features/patients/api/` (research R1, R4).
- **No `router.refresh()` to show patient data.** The record on screen comes from a read, or from what `POST` or `PATCH` returned.
- **Links to a record use only `PatientLink`** (research R2).
- **Search terms stay in component state.** Never in an address, title, log, or browser storage.
- Response bodies are checked by Zod schemas with `satisfies z.ZodType<Generated>`.
- Logical CSS only. No `any`. Test data is synthetic, including anything typed by hand.
- Tests use role queries. `getByLabel` needs `.locator("visible=true")` after a soft navigation, as hidden pages stay in the DOM.
- Counting `patient.opened` is only meaningful on a production build, which the Playwright suites use.

---

## Phase 1: Setup

- [X] T001 Confirm that `pnpm check` passes on the branch before any change, and record the result in this file

---

## Phase 2: Foundational (blocks every story)

### Patient logic

- [X] T002 [P] Write failing tests, then add `src/features/patients/types.ts` over `src/lib/api/generated/patients.ts`, and `src/features/patients/schemas/patient.ts` with `schemas/patient.test.ts`. Response schemas for `PatientSummary` and `Patient`, using `satisfies z.ZodType<Generated>`. A form schema factory that takes the clinic's today and translated text, with these rules: `full_name` not blank after trimming, at most 255; `date_of_birth` required, between 130 years ago and the clinic's today by string comparison, never through `Date`; `sex` required, `male` or `female`, no default; `phone` required, after removing spaces, dashes, and parentheses, `^\+?[0-9]{8,15}$`; `national_id` optional, `^[23][0-9]{13}$`; `address` optional, at most 500; emergency contact all three parts or none, `name` at most 255, `relationship` at most 50, `phone` same as `phone`. Digits convert through `toWesternDigits` before checks, on phone, national ID, and emergency phone only (FR-010, FR-031, data-model)
- [X] T003 [P] Write failing tests, then implement record-to-form, form-to-register-body, and form-to-changes in `src/features/patients/form-values.ts` with `form-values.test.ts`. Cover: `null` to `""`; blank optionals left out of a register body; only differing fields in changes; blank optional with a value becomes `null`; a contact sent whole when any part differs; all three blank with one recorded becomes `null`; all three blank with none recorded is no change; `010 0000 0001` over `01000000001` is no change; trimmed spaces are no change; nothing differing returns an empty result (FR-018, research R6)
- [X] T004 [P] Write failing tests, then implement `src/features/patients/opening.ts` with `opening.test.ts`: `handOver(record)` and `takeHandedOver(id)`, used up on taking, and for that id only; `markAsked(id)` and `takeAsked(id)`, used up on taking; `noteChange()` and `changeCount()`. Memory only (research R2, R3, R4)
- [X] T005 Write failing tests, then implement `src/features/patients/api/patients.ts` with `patients.test.ts`: `searchPatients(terms, page, locale)`, leaving blank terms out; `findByPhone(phone, locale)` with `per_page=10`; `readPatient(id, locale)`; `registerPatient(body, locale)`; `updatePatient(id, changes, locale)`. All use `browserApi`, and check responses with the schemas from T002. A body failing the check gives a failed result, as `readResource` does

### Shared components

- [X] T006 [P] Write failing tests, then extend `src/components/shared/filter-bar.tsx`, with cases in `filter-bar.test.tsx`: an optional `errors` prop shown on each field; `autoComplete="off"` on `inAddress: false` filters; existing behaviour unchanged (research R5, FR-029)
- [X] T007 [P] Write failing tests, then extend `src/components/shared/data-table.tsx`, with cases in `data-table.test.tsx`: pagination takes `onPage` as an alternative to `hrefForPage`, rendering buttons in place of links, with the same summary and labels (research R5)
- [X] T008 [P] Write failing tests, then add an optional `onRetry` to `src/features/auth/components/api-failure-state.tsx`, with cases in `api-failure-state.test.tsx`: when given, the retry button calls it rather than reloading. Export the component from `src/features/auth/public.ts` as well, and confirm that it builds in a Client Component (research R5)

### Fake backend and messages

- [X] T009 Add stateful synthetic patients to `e2e/support/fake-clinic.mjs`, reset by `/__control/reset`, per the contract: list with `name`, `phone`, `national_id`, and `id` filters, with paging; `422` on a malformed `phone` or `national_id` under those keys; `POST` and `PATCH` with the keys in `contracts/api-usage.md`, including a repeated `national_id` and nested `emergency_contact.*`; an empty `PATCH` as `422` under `fields`; `403` for doctors; `404` for an unknown id. Count record reads in a way tests can query, and count a no-change `PATCH` as a read, as the API does. Existing behaviour unchanged
- [X] T010 Add the `patients` namespace to `src/messages/en.json` and `src/messages/ar.json`, with `sex.male`, `sex.female`, and the first keys. Later tasks add to it

### Decision record

- [X] T010a Write `docs/decisions/0012-audited-reads-in-the-browser.md` per the plan, with status "Proposed", before the reader is built. It must state that it reverses ADR 0005's rejection of fetching audited records outside TanStack Query, with the measurements from research R1 and R2, and must record the two readings of the constitution: the patient number in an address (Principle II), and registering not being irreversible (Principle VI). Update `docs/decisions/README.md`, and add pointers to it in `docs/decisions/0005-audit-safe-data-fetching.md` and `docs/decisions/0006-cache-components.md`

**Checkpoint**: All existing tests still pass. No screen has changed.

---

## Phase 3: User Story 5 - Roles and refusals (Priority: P1)

**Goal**: Administrators and receptionists can reach the patient pages, and a doctor gets no content and causes no patient request.

**Independent Test**: Sign in as each role, compare every patient address against the matrix, and confirm through the fake backend's calls that a doctor caused no patient request.

- [X] T011 [US5] Write failing tests in `e2e/patients.spec.ts`: a doctor has no navigation entry, and `/patients`, `/patients/new`, and `/patients/5` show "not allowed" with no call to `patients*`, in both languages; an administrator and a receptionist reach all three; `/patients/abc` and `/patients/0` give the neutral not-found state with no call
- [X] T012 [US5] Add the three pages, each with `<Suspense>`, `ScreenGate path="patients"`, and `ScopedMessages`: `src/app/[locale]/(app)/patients/page.tsx`, `patients/new/page.tsx`, and `patients/[id]/page.tsx`, the last using `readPositiveId`. Each page's content is its header for now. The tab title is the fixed page name (FR-016, FR-021, FR-022)
- [X] T013 [US5] Set `built: true` on `patients` in `src/lib/auth/app-routes.ts`, then update whatever assumed a placeholder: check `src/lib/auth/app-routes.test.ts`, `e2e/navigation.spec.ts`, `e2e/session-end.spec.ts`, and `e2e/live/auth.spec.ts`. Any test still meaning "a page not built yet" moves to a later phase's address, without weakening it
- [X] T014 [US5] Confirm by test that sign-in doesn't return to `/patients/5` or `/patients/new` in `e2e/session-end.spec.ts`, and that `src/lib/auth/return-address.test.ts` still covers them, with no search terms carried (FR-023)

**Checkpoint**: Access is correct for every role. All three pages exist, and are nearly empty.

---

## Phase 4: User Story 3 - View a patient's full record (Priority: P1)

**Goal**: A person opens one patient and sees everything recorded. One opening is written for each time they asked, and no others.

**Independent Test**: The opening-count table in [quickstart.md](quickstart.md), on a production build, with real entries.

### Tests

- [X] T015 [P] [US3] Write failing tests in `src/features/patients/components/patient-link.test.tsx`: `prefetch` off; a plain click calls `markAsked`; a click with Ctrl, Meta, or Shift, or a middle click, doesn't
- [X] T016 [P] [US3] Write failing tests in `src/features/patients/components/patient-record.test.tsx` with a mocked API module. Reads once on mounting. Doesn't read on re-render, or on focus, visibility, or online events. Reads again when the effect re-runs with a mark, and doesn't without one. A handed-over record shows with no read. `403`, `404`, and other failures show their states, with no automatic retry. "Try again" and "Reload details" each read once. A repeat read's network or server failure keeps the record, labelled as possibly out of date. A repeat read's `403` or `404` removes the record from the screen and shows that state. "Reload details" states that it records another opening. Absent values read "not recorded"

### Implementation

- [X] T017 [P] [US3] Implement `src/features/patients/components/patient-link.tsx`, and export it from `src/features/patients/public.ts` (research R2)
- [X] T018 [P] [US3] Implement `src/features/patients/components/patient-details.tsx`: number, name, sex, date of birth, phone, national ID, address, emergency contact, registered, and last changed. Uses `UserText` for names and addresses, `ClinicDate` for the date of birth, `Instant` with the clinic's zone for the times, `LtrText` for phone and national ID, translated sex, and "not recorded" in words (FR-013, FR-027, FR-028)
- [X] T019 [US3] Implement `src/features/patients/components/patient-record.tsx`, the reader, per the state flow in [data-model.md](data-model.md). A ref and `takeAsked` guard the effect, and `takeHandedOver` comes first. A request counter means only the newest answer applies. Uses `LoadingState`, `ApiFailureState` with `onRetry`, and "Reload details" with its hint (FR-014, FR-015, research R1, R2)
- [X] T020 [US3] Use `PatientRecord` in `src/app/[locale]/(app)/patients/[id]/page.tsx`, passing the id, the clinic's time zone, and the clinic's today from `clinicToday` for the edit form's date check, with no read on the server. The header's name comes from the reader, so that it's never in the tab title (FR-016)
- [X] T021 [US3] Add to `e2e/patients.spec.ts`: every state in both languages on the fake backend; "not recorded"; a long name and address wrap at tablet and phone width; the tab title holds no patient details; no read on hover, or on going back

### Live evidence

- [X] T022 [US3] Write `e2e/live/patients.spec.ts` with the opening-count steps that are possible so far, counting through `GET /audit-entries?patient_id=<id>&action=patient.opened`, on synthetic patients made through the API. Nothing links to a record yet, so these steps start from its address: load 1; focus events 1; away by the navigation and back 1; a real change on `/specialties`, then back, 1; "Reload details" 2; reload 3; language switch 4. T029 adds the steps that need a link
- [X] T023 [US3] Check once by hand on `pnpm dev`, with a synthetic patient, whether opening writes one entry or two under Strict Mode. Record what's observed in research R2, whichever it is, and report any difference rather than hiding it

**Checkpoint**: The audited core is proven against the real API. Nothing can yet lead to the page except its address.

---

## Phase 5: User Story 1 - Find a returning patient (Priority: P1)

**Goal**: Reception searches by name, phone, patient number, or national ID, and sees a short list that leads to the right record, with the terms kept out of the address.

**Independent Test**: With synthetic Arabic and English names, search each way, confirm the matches, and confirm that the address never held a term.

### Tests

- [ ] T024 [US1] Write failing tests in `src/features/patients/components/patient-search.test.tsx` with a mocked API module. No request on first show, or while typing. All-blank submission asks for a term, with no request. Whitespace counts as blank. Digits convert in phone, number, and national ID, and the name is untouched. Blank terms aren't sent. `422` shows on the right field. Empty keeps terms and offers registering. Errors keep terms, and retry repeats the search. A newer search overrides an older answer. Paging keeps terms. "Reset" clears all. The effect repeats the last search only if `changeCount` moved, and only if a search has been made

### Implementation

- [ ] T025 [US1] Implement `src/features/patients/components/patient-search.tsx`: `FilterBar` with four `inAddress: false` filters and match hints (FR-002), `DataTable` with `onPage` and `PatientLink`, showing only number, name, sex, date of birth, and phone (FR-005), and all states in [contracts/screens.md](contracts/screens.md). No sort control (FR-001, FR-003, FR-004, research R4)
- [ ] T026 [US1] Use `PatientSearch` in `src/app/[locale]/(app)/patients/page.tsx`, with the page header and a "Register a patient" link
- [ ] T027 [US1] Add to `e2e/patients.spec.ts`: the first view makes no call; the address stays `/patients` after search and paging; going back from a patient restores terms and results (FR-007); a reload clears them; terms are absent from `localStorage` and `sessionStorage`, and from every address the page visited, recorded through Playwright's `framenavigated` event; fields have autofill off; empty, error, and `422` states, in both languages
- [ ] T028 [US1] Add to `e2e/live/patients.spec.ts`: Arabic names found across alef, taa marbuta, and yaa spellings, by the API alone (SC-004); several patients sharing a phone; phone with separators and Arabic digits; exact patient number and national ID; malformed values show the API's message; paging uses the API's totals
- [ ] T029 [US1] Add the steps that need a link to the opening-count test in `e2e/live/patients.spec.ts`, from real search results, following [quickstart.md](quickstart.md): results shown and a result hovered 0; click 1; away and back 1; a real change on `/specialties`, then back, 1; click the same result again 2; Ctrl+click, where the new tab reads, 3; back in the first tab 3

**Checkpoint**: Reception can find and view any patient. This is the first useful increment for returning patients.

---

## Phase 6: User Story 2 - Register a new patient (Priority: P1)

**Goal**: Reception registers a patient, is warned about possible duplicates by phone, and sees the returned record, with no opening written.

**Independent Test**: Register with required details only and with every detail, then provoke each refusal. Confirm `patient.registered` once and no `patient.opened`.

### Tests

- [ ] T030 [US2] Write failing tests in `src/features/patients/components/register-patient.test.tsx` with a mocked API module. Quick feedback for each rule in T002. `sex` has no preselected value. Every field has autofill off. Each API key shows on its field, including `emergency_contact.*`, and others at form level. Typed values are kept after a refusal. No duplicates found: `POST`, then `handOver`, `noteChange`, `reset`, `router.replace` to the record, and a confirmation naming the number. Matches: no `POST`, panel shown. "Register anyway" posts with no second check. Changing the phone removes the panel, and the next submit checks. A format-invalid phone skips the check. A failed check offers "Try again" and "Register anyway". A `403` on the check takes the usual route, not the failed-check panel. Double submission is blocked in both the check and the save

### Implementation

- [ ] T031 [P] [US2] Implement `src/features/patients/components/patient-fields.tsx`: the fields shared by register and edit, using `FormField`, with `dir="auto"` on names and address, `dir="ltr"` on phone and national ID, `type="date"` on the date of birth, and `autoComplete="off"` on all. Takes `register` and `errors`, and holds no state (FR-008, FR-009, FR-029)
- [ ] T032 [P] [US2] Implement `src/features/patients/components/possible-matches.tsx`: the panel for matches, with list fields only, `PatientLink`, the total, wording that notes families often share a phone, and "Register anyway"; and for a failed check, "Try again" and "Register anyway" (FR-012, research R8)
- [ ] T033 [US2] Implement `src/features/patients/components/register-patient.tsx`, per the register flow in [data-model.md](data-model.md), using `useFormSubmit`, with a note to search first (FR-008, FR-010, FR-011, FR-012, FR-026)
- [ ] T034 [US2] Use `RegisterPatient` in `src/app/[locale]/(app)/patients/new/page.tsx`, passing the clinic's today from `clinicToday`
- [ ] T035 [US2] Add to `e2e/patients.spec.ts`: each refusal on its field, in both languages; the panel; opening a match and returning keeps what was typed (US2 scenario 9); the returned form is empty after success; no read of the record after registering; the search results gain the new patient when returned to
- [ ] T036 [US2] Add to `e2e/live/patients.spec.ts`: required-only and all-details registration, with values confirmed through the API; `patient.registered` once and `patient.opened` 0; reload then gives 1, and no second patient; a repeated national ID; a shared phone warns, and "Register anyway" succeeds; every field's refusal matches the contract (SC-007)

**Checkpoint**: The clinic can find, view, and register patients, which is enough for Phase 6 to book them.

---

## Phase 7: User Story 4 - Correct a patient's details (Priority: P2)

**Goal**: Staff edit a record on its own page, sending only what changed, with no further read.

**Independent Test**: Change a phone and clear an address, then confirm values and number through the API, and confirm `patient.updated` with no new `patient.opened`.

### Tests

- [ ] T037 [US4] Write failing tests in `src/features/patients/components/patient-edit-form.test.tsx` with a mocked API module. Filled from the given record, with no read. Only changed fields sent. Nothing changed: no request, and "nothing to save". Clearing sends `null`. Emptying all three contact parts sends `null`, and one part changed sends the whole contact. An emptied required field gives quick feedback. Each key shows on its field, and `emergency_contact` and `fields` at form level. Cancel returns the record untouched. On success: `onSaved` receives the returned record, and `noteChange` runs. Double submission is blocked. Add cases to `patient-record.test.tsx`: "Edit" and "Save" cause no read, "Reload details" isn't available while editing, and a read arriving during editing keeps what was typed (research R7)

### Implementation

- [ ] T038 [US4] Implement `src/features/patients/components/patient-edit-form.tsx`, using `patient-fields.tsx`, `form-values.ts`, and `useFormSubmit`, with no `router.refresh()` on success (FR-017, FR-018, FR-019)
- [ ] T039 [US4] Add "Edit" and the editing state to `src/features/patients/components/patient-record.tsx`. The saved record replaces the one in state, with a confirmation (FR-019, FR-020)
- [ ] T040 [US4] Add to `e2e/patients.spec.ts`: all of US4's scenarios on the fake backend, in both languages, including that no request is sent with nothing changed, that held results show new values on returning, and that a just-registered record, which arrived with no read, can be edited (FR-011)
- [ ] T041 [US4] Add to `e2e/live/patients.spec.ts`: edit steps in the opening-count test: a change gives `patient.updated` with no new opening; nothing changed gives no request; clearing is confirmed through the API; the patient number is unchanged; results show the new name on returning; a national ID held by another patient is refused on its field

**Checkpoint**: All five stories work independently.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T042 [P] Add the three patient pages, and their form, warned, and editing states, to `e2e/accessibility.spec.ts`, in both languages and directions, and make any fix needed (SC-009)
- [ ] T043 [P] Add a keyboard-only test for finding, registering, and editing to `e2e/patients.spec.ts`, and add the patient screens at tablet and phone width to `e2e/clinic-layout.spec.ts` (SC-009)
- [ ] T044 Add forced-refusal tests to `e2e/patients.spec.ts`, after T043, which edits the same file: a role changed mid-session gives `403` on search, on the duplicate check, on opening, on "Reload details", and on saving, with a clear state each time and no patient details left on screen; `401` at each ends the session (FR-022, SC-006)
- [ ] T045 Add to `e2e/live/patients.spec.ts`: after a full journey and sign-out, going back shows no patient details, and storage holds no synthetic term or detail (FR-024). Start the application server with its output captured to a temporary file for the live run, and search that output for every synthetic term and detail used (SC-005). Add a doctor and a receptionist account check against the matrix (SC-006). Time registering (under 1 minute, SC-001) and finding and opening by each search type (under 30 seconds, SC-002) as a guard against slowness; a script's time isn't a person's, so real speed is judged in T049's walkthrough
- [ ] T046 Confirm by search that nothing logs patient data or search terms, that no patient read exists outside `src/features/patients/api/`, that no `*-server.ts` exists in the feature, that no `<Link>` to a record bypasses `PatientLink`, and that the feature calls no appointment, encounter, or billing endpoint (FR-030, FR-032)
- [ ] T047 Update `docs/decisions/0012-audited-reads-in-the-browser.md` with the observed results of T022, T023, and T029. It stays "Proposed" until the owner accepts it
- [ ] T048 [P] Update `docs/architecture.md`, `docs/backend-integration.md` (research R6, and patient operations confirmed live), `docs/frontend-blueprint.md`, `docs/development-guidelines.md`, and `docs/roadmap.md`
- [ ] T049 Run `pnpm check` and `pnpm test:e2e:live`, walk through the manual scenarios in [quickstart.md](quickstart.md) in both languages, and record what was actually observed in this file. Failures are fixed or reported, and never hidden
- [ ] T050 Run `/code-review` on the branch, resolve its findings, and run T049's checks again

---

## Dependencies & Execution Order

### Phases

- **Setup (Phase 1)**, then **Foundational (Phase 2)**: block everything.
- **US5 (Phase 3)**: needs Foundational. Every page depends on it.
- **US3 (Phase 4)**: needs US5.
- **US1 (Phase 5)**: needs US3, as results link to records.
- **US2 (Phase 6)**: needs US3, for showing the handed-over record, and benefits from US1. It can run beside US1, apart from `e2e/patients.spec.ts` and `e2e/live/patients.spec.ts`.
- **US4 (Phase 7)**: needs US3. Its "results update" checks need US1.
- **Polish (Phase 8)**: needs all stories.

### Within a story

Tests first, and failing. Then leaf components, the composing component, the page, the fake-backend end-to-end tests, and finally the live evidence.

### Spec coverage

| Requirements | Tasks |
|---|---|
| FR-001 to FR-007 | T006, T007, T017, T024 to T029 |
| FR-008 to FR-012 | T002, T003, T030 to T036 |
| FR-013 to FR-016 | T012, T015 to T023 |
| FR-017 to FR-020 | T003, T037 to T041 |
| FR-021 to FR-024 | T011 to T014, T044, T045 |
| FR-025 to FR-032 | T002, T006, T010, T018, T031, T042 to T046. FR-032 holds because no such endpoint is called, confirmed by T046 |
| SC-003 | T022, T029, T041 |
| SC-010, SC-011 | T028, T036, T041, T049 |

---

## Parallel Examples

```text
# Foundational: pure logic and shared components, all different files
T002 schemas   T003 form-values   T004 opening
T006 filter-bar   T007 data-table   T008 api-failure-state

# US3: leaf pieces, before the reader that composes them
T015 and T017 patient-link   T016 reader tests   T018 patient-details

# US2: leaf pieces, before the form that composes them
T031 patient-fields   T032 possible-matches

# Polish
T042 accessibility   T043 keyboard and layout   T048 documents
```

---

## Implementation Strategy

**Smallest useful increment**: Phases 1 to 5, covering US5, US3, and US1. Staff can find and view existing patients, with the audit behaviour proven against the real API. Registering arrives with US2, so until then a demonstration uses synthetic patients made through the API.

**What Phase 6 of the roadmap needs**: through US2 here, since booking needs patients to exist.

**Phase complete**: all stories and polish, with T049 and T050 passed, and the owner's acceptance recorded.

**Stop and report if** the opening count in T022 or T029 differs from the spike's. That would mean the design's basis has changed, and the plan needs revisiting before continuing.

## Results

Filled in as tasks run. Only observed results.

| Task | Result |
|---|---|
| T001 | `pnpm check` passed before any change: 496 end-to-end tests in 11.1 minutes |
| T022 | Live, production build, real entries: load 1, focus events 1, away and back 1, a real change on `/specialties` then back 1, "Reload details" 2, reload 3, language switch 4. All as the spike measured. Zero server errors in the run |
| T023 | Development server (`next dev`), real entries: first opening 1, away and back 1. No doubled entry. Strict Mode's own repeat is also covered by a unit test in `patient-record.test.tsx` |
