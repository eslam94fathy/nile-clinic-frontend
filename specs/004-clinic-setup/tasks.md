# Tasks: Clinic Setup

**Input**: Design documents from `specs/004-clinic-setup/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/api-usage.md](contracts/api-usage.md), [contracts/screens.md](contracts/screens.md), [quickstart.md](quickstart.md)

**Tests**: Required by the constitution (VIII) and the guidelines' testing table. Within a story, tests come first and must fail before the code that satisfies them is written.

**Organization**: By user story, in dependency order rather than number order. User Story 1 is the journey across the other screens, so its phase comes after the screens it joins: specialties (US3), staff (US2), doctors (US4), schedule (US5), and fees (US6). Each screen is still testable by itself.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: The user story a task belongs to

## Rules for every task

- Check each API detail in [contracts/api-usage.md](contracts/api-usage.md) and the snapshot in `contracts/`. Never invent one.
- All text goes in both `src/messages/en.json` and `src/messages/ar.json`, with identical keys. Arabic is checked as each screen is built.
- Page content goes inside `<Suspense>` and `ScreenGate`. Server reads use `serverApi`, and client calls use `browserApi`, only inside a feature's `api/` folder.
- After a successful change: `router.refresh()`, or navigate to the new record. No optimistic updates.
- Response bodies are checked by Zod schemas with `satisfies z.ZodType<Generated>`.
- Logical CSS only. No `any`. Money is a string. Test data is synthetic.
- Tests use role queries, which skip the hidden copies of earlier pages (research R1).

---

## Phase 1: Setup

- [X] T001 Confirm that `pnpm check` passes on the branch before any change, and record the result here

---

## Phase 2: Foundational (blocks every story)

### Pure helpers

- [X] T002 [P] Write failing tests, then implement `clinicToday(timeZone, now)` and `addDays(date, count)` in `src/lib/format/clinic-today.ts` with `src/lib/format/clinic-today.test.ts`, covering midnight in `Africa/Cairo` against UTC, month and leap-year boundaries, and daylight-saving changes (research R9)
- [X] T003 [P] Write failing tests, then implement Arabic-Indic to Western digit conversion in `src/lib/format/digits.ts` with `src/lib/format/digits.test.ts`, leaving every other character alone (research R7)

### Gate and failure display

- [X] T004 Add an optional `capability` prop to `ScreenGate`: a role without it gets `ForbiddenState`, and children aren't rendered, in `src/features/auth/components/screen-gate.tsx`, with cases in `src/features/auth/components/screen-gate.test.tsx` (research R3)
- [X] T005 Write failing tests, then build `ApiFailureState` for `401` (`SessionEndRedirect`), `403` (`ForbiddenState`), `404` (`NotFoundState`), and others (`ErrorState` with the API's message or general text, plus `RetryButton`) in `src/features/auth/components/api-failure-state.tsx` with `api-failure-state.test.tsx`, exported from `src/features/auth/public-server.ts`
- [X] T006 Add a `readPositiveId(value)` helper in `src/lib/api/read-positive-id.ts`, with a test, so that a non-numeric, zero, or negative id gives `notFound()` before any API call

- [X] T006a Add `src/features/app-shell/public.ts`, exporting `Can`, so that other features use it through a deliberate public export (constitution IV)

### Fake backend

- [X] T007 Add routes with ids to `e2e/support/fake-backend.mjs`, so that a path such as `doctors/3/fee` matches a pattern. Keep the exact routes and `/__control/script` working, including scripting by pattern
- [X] T008 Add stateful synthetic data to `e2e/support/fake-backend.mjs`, reset by `/__control/reset`: staff with paging and filters, specialties, doctors, schedules, slots computed simply from the schedule, time off, and fees. Refuse with the contract's keys: `periods.N`, `periods.N.start`, `user_id`, `registration_number`, `amount`, and last-administrator `message` only. Enforce role refusals with `403`

### Messages

- [X] T009 Add `days.sunday` to `days.saturday`, and the namespaces `staff`, `specialties`, `doctors`, `scheduling`, `fees`, with their first keys, to `src/messages/en.json` and `src/messages/ar.json`. Later tasks add to them

**Checkpoint**: All existing tests still pass. The fake backend's existing behaviour is unchanged.

---

## Phase 3: User Story 3 - Maintain the specialty catalog (P1)

**Goal**: An administrator keeps the catalog of specialties, in both languages.

**Independent Test**: Add, rename, deactivate, and reactivate a synthetic specialty.

### Tests

- [X] T010 [P] [US3] Component tests for the add and rename forms in `src/features/doctors/components/specialty-form.test.tsx`: required names, "at most 100", `422` on each name, form-level errors, no request when nothing changed, and no double submission
- [X] T011 [P] [US3] End-to-end tests in `e2e/specialties.spec.ts`, in both languages: loading, empty, error, and success states, and the deactivate confirmation's text. Administrator only

### Implementation

- [X] T012 [P] [US3] Names over generated types in `src/features/doctors/types.ts`, and schemas in `src/features/doctors/schemas/specialty.ts`
- [X] T013 [US3] API module in `src/features/doctors/api/specialties.ts`: list with optional `is_active` sent as `1` or `0`, create, rename with only changed names, deactivate, reactivate. Server reads go in `specialties-server.ts`
- [X] T014 [US3] Build the add form, rename-in-row, and status actions in `src/features/doctors/components/specialty-form.tsx` and `specialty-list.tsx`, returning focus after a rename, and using `ConfirmDialog` for deactivating
- [X] T015 [US3] Build `src/app/[locale]/(app)/specialties/page.tsx`, gated on `specialties`, and set `built: true` in `src/lib/auth/app-routes.ts`

**Checkpoint**: The catalog works by itself. It sets the pattern for later lists and forms.

---

## Phase 4: User Story 2 - Manage staff accounts (P1)

**Goal**: An administrator manages all staff accounts, including their own, within what the API allows.

**Independent Test**: Perform each action on synthetic accounts, and confirm the effects through the API.

### Tests

- [X] T016 [P] [US2] Component tests in `src/features/staff/components/staff-forms.test.tsx`: "12–72 characters", confirmation matching, `422` on each field with typed values kept except passwords, only changed fields sent, no request when nothing changed, and passwords cleared
- [X] T017 [P] [US2] Component tests in `src/features/staff/components/account-actions.test.tsx`: each confirmation's text, the last-administrator refusal shown in the dialog, and the own-account differences (password replaced by a link to `/account`, loss-of-access sentence added)
- [X] T018 [P] [US2] End-to-end tests in `e2e/staff.spec.ts`, in both languages: filters and page surviving a reload and the back button, all states, create leading to the account, an invalid filter handled, and an unknown or non-numeric id giving not-found

### Implementation

- [X] T019 [P] [US2] Types in `src/features/staff/types.ts` using `StaffMember` through `features/auth`'s public export, and schemas in `src/features/staff/schemas/`, with passwords required at 12–72 characters and a matching confirmation
- [X] T020 [US2] API modules in `src/features/staff/api/`: list and get on the server; create, update, deactivate, reactivate, and set password in the browser
- [X] T021 [US2] Build the list and filters in `src/features/staff/components/staff-list.tsx` and `src/app/[locale]/(app)/staff/page.tsx`. Don't offer a name search (gap G1). Set `built: true`
- [X] T022 [US2] Build the create form with `method="post"`, and `?role=doctor` preselecting the role, in `src/features/staff/components/staff-create-form.tsx` and `src/app/[locale]/(app)/staff/new/page.tsx`
- [X] T023 [US2] Build the edit form and account actions in `src/features/staff/components/staff-edit-form.tsx`, `account-actions.tsx`, `set-password-form.tsx`, and `src/app/[locale]/(app)/staff/[id]/page.tsx`. The page compares ids on the server, and adds the role-change warnings (research R11, FR-009, FR-010)

**Checkpoint**: Accounts can be managed by themselves. The "create doctor profile" offer arrives with US4.

---

## Phase 5: User Story 4 - Maintain doctor profiles (P1)

**Goal**: An administrator finds doctors, creates profiles, and edits them.

**Independent Test**: Create and edit a synthetic doctor, including each refusal.

### Tests

- [X] T024 [P] [US4] Component tests in `src/features/doctors/components/doctor-form.test.tsx`: title "at most 100", "at least one" specialty, `422` on `user_id`, `title`, `registration_number`, `specialty_ids`, and `specialty_ids.0`, a blank number left out on create and sent as `null` on edit, only changed fields sent, and a deactivated assigned specialty shown and kept
- [X] T025 [P] [US4] End-to-end tests in `e2e/doctors.spec.ts`, in both languages: list filters surviving a reload, the account table and its note about existing profiles, an account refused for already having a profile, no accounts and no specialties states, and an inactive doctor's notice

### Implementation

- [X] T026 [US4] Add doctor types and schemas in `src/features/doctors/types.ts` and `schemas/doctor.ts`, and API modules in `src/features/doctors/api/`
- [X] T027 [US4] Build the list in `src/features/doctors/components/doctor-list.tsx` and `src/app/[locale]/(app)/doctors/page.tsx`, with name, specialty, and status filters marked `inAddress: true`, and "New doctor" inside `Can`. Set `built: true`
- [X] T028 [US4] Build the specialties checkbox group in `src/features/doctors/components/specialty-choices.tsx`: a `fieldset` with `legend`, native checkboxes, and "deactivated" labels (research R12)
- [X] T029 [US4] Build `/doctors/new` in `src/app/[locale]/(app)/doctors/new/page.tsx`, gated with `capability="manageDoctors"`: the account table (`GET /staff?role=doctor&is_active=1&per_page=50`) with no `account`, and the form with one. It needs read access to accounts, so `features/staff` exports its server read through `features/staff/public-server.ts` (research R4)
- [X] T030 [US4] Build the edit page in `src/app/[locale]/(app)/doctors/[id]/edit/page.tsx`, gated with `capability="manageDoctors"`
- [X] T031 [US4] Build the doctor's page frame in `src/app/[locale]/(app)/doctors/[id]/page.tsx`, with the profile section in `src/features/doctors/components/doctor-profile.tsx`, the `cache()`d read, and a whole-page not-found on a `404` from the profile (research R2). Edit is inside `Can`
- [X] T032 [US4] Offer "Create doctor profile" on active doctor-role accounts in `src/features/staff/components/account-actions.tsx`, and send a newly created doctor-role account to `/doctors/new?account=<id>` in `staff-create-form.tsx`

**Checkpoint**: A doctor can be created from an account, and appears on the list.

---

## Phase 6: User Story 5 - Set a doctor's weekly hours (P1)

**Goal**: An administrator sets and clears a doctor's whole week.

**Independent Test**: Save split days, confirm the slots from the API, then provoke refusals and confirm that they land against the right period.

### Tests

- [X] T033 [P] [US5] Unit tests in `src/features/scheduling/schedule-form-values.test.ts`: flattening `days` in order, building rows in on-screen order, and keeping `24:00`
- [X] T034 [P] [US5] Component tests in `src/features/scheduling/components/schedule-editor.test.tsx`: `HH:MM` format including `24:00` and Arabic digits, "at most 4" rows per day, `periods.N` and `periods.N.start` shown against the right row after rows were added in the middle of a week, `appointment_minutes` "5–240" in multiples of 5, other keys at form level, and entries kept on refusal
- [X] T035 [P] [US5] End-to-end tests in `e2e/schedule.spec.ts`, in both languages: empty state with all 7 days, save and clear, the statement about existing appointments, `24:00`, and a receptionist getting "not allowed" with no page content sent

### Implementation

- [X] T036 [P] [US5] Types, Zod schemas, and `schedule-form-values.ts` in `src/features/scheduling/`, and API modules in `src/features/scheduling/api/`: `getSchedule`, `saveSchedule`, `clearSchedule`
- [X] T037 [US5] Build the read-only `WeeklyHours` display in `src/features/scheduling/components/weekly-hours.tsx`, using `ClinicTime` for times, and add its section to the doctor's page, with a link to the editor inside `Can`
- [X] T038 [US5] Build the editor in `src/features/scheduling/components/schedule-editor.tsx`, using `useFieldArray` with rows grouped by day, text inputs for times (research R5, R6), and clear through `ConfirmDialog`
- [X] T039 [US5] Build `src/app/[locale]/(app)/doctors/[id]/schedule/page.tsx`, gated with `capability="manageSchedules"`

**Checkpoint**: Schedules can be saved, and the API returns slots for them.

---

## Phase 7: User Story 6 - Set and review fees (P1)

**Goal**: An administrator sets a fee, and permitted roles review all fees.

**Independent Test**: Set and change a synthetic doctor's fee, and confirm amount, setter, and time in both places.

### Tests

- [X] T040 [P] [US6] Unit tests in `src/features/fees/schemas/fee.test.ts`, with no arithmetic on the amount: `0`, `0.00`, `0.01`, `350.1`, `350.10`, `100000`, `100000.00`, `100000.01`, `1234567`, three decimals, `٣٥٠`, and text (research R8)
- [X] T041 [P] [US6] Component tests in `src/features/fees/components/fee-form.test.tsx`: `422` on `amount`, form-level errors, no double submission, and the note about existing charges
- [X] T042 [P] [US6] End-to-end tests in `e2e/fees.spec.ts`, in both languages: "not set" rather than zero, setter and time in the clinic's zone, paging surviving a reload, Arabic digits sent as Western, and rows leading to the doctor

### Implementation

- [X] T043 [US6] Types, the schema `above 0, at most 100000, with at most two decimals`, and API modules in `src/features/fees/`
- [X] T044 [US6] Build the fee section in `src/features/fees/components/fee-section.tsx` and `fee-form.tsx`, and add it to the doctor's page, with the form inside `Can`
- [X] T045 [US6] Build the list in `src/features/fees/components/fee-list.tsx` and `src/app/[locale]/(app)/fees/page.tsx`, and set `built: true`

**Checkpoint**: Fees can be set, and they appear in both places.

---

## Phase 8: User Story 1 - Take a new doctor from account to bookable (P1) 🎯 Phase done condition

**Goal**: The steps join into one guided journey, and the page says truthfully how far it has got.

**Independent Test**: With no record of the person, complete all steps using only the application, and confirm "setup complete" with slots from the API.

### Tests

- [X] T046 [P] [US1] Unit tests in `src/features/doctors/readiness.test.ts`: every combination in the data model's readiness table, including each `unknown`, slots with no fee, and a fee with no slots
- [X] T047 [P] [US1] End-to-end tests in `e2e/doctors.spec.ts`: each readiness state, one section failing while others work, "bookable" with the charge warning, slots appearing after a schedule is saved (US5 scenario 2), and the journey by keyboard alone
- [X] T048 [US1] Live journey in `e2e/live/clinic-setup.spec.ts`, in English and in Arabic, against the real API: new account, profile, hours, then "bookable" with the warning, fee, then "setup complete", then that doctor signs in with no "profile not set up" state

### Implementation

- [X] T049 [US1] Implement `src/features/doctors/readiness.ts` as a pure function taking plain values
- [X] T050 [US1] Build the slots section in `src/features/scheduling/components/upcoming-slots.tsx` and its API read, for today to today + 30: a count and the first 7 dates with slots (research R9, R10)
- [X] T051 [US1] Build the readiness summary in `src/features/doctors/components/readiness-summary.tsx`, stating each item in words, with links to each step, and add it to the doctor's page for administrators

**Checkpoint**: **The phase's done condition is met.** Run T048 before continuing.

---

## Phase 9: User Story 7 - Record and remove time off (P2)

**Goal**: An administrator records and removes a doctor's time off.

**Independent Test**: Record whole-day and part-day entries, confirm that slots disappear, remove one, and confirm that they return.

### Tests

- [X] T052 [P] [US7] Component tests in `src/features/scheduling/components/time-off-form.test.tsx`: whole-day and part-day values sent correctly, reason "at most 255" and left out when blank, the no-medical-details hint and the statement that all staff can read it, and `422` on each field
- [X] T053 [P] [US7] End-to-end tests in `e2e/time-off.spec.ts`, in both languages: default range, another range in the address, an over-long range's refusal, no removal offered when the end date has passed, and a refusal for an entry ended earlier today shown in the dialog

### Implementation

- [X] T054 [US7] API modules for list, record, and remove in `src/features/scheduling/api/`, and types and schemas
- [X] T055 [US7] Build the read-only `TimeOffList` in `src/features/scheduling/components/time-off-list.tsx`, and add the section to the doctor's page with a range filter
- [X] T056 [US7] Build `src/features/scheduling/components/time-off-form.tsx` and removal with `ConfirmDialog`, inside `Can`, with the statement about existing appointments

**Checkpoint**: Time off changes the slots shown.

---

## Phase 10: User Story 8 - Reception can look up doctors and fees (P2)

**Goal**: Reception reads everything, and is offered no change.

**Independent Test**: Sign in as a receptionist, and check each page.

### Tests

- [X] T057 [US8] End-to-end tests in `e2e/clinic-roles.spec.ts`: each role against every new page and control, compared with the permission matrix; "not allowed" pages lacking the page's text; a forced change answered with `403` showing a clear state; and, through the fake backend's `/__control/calls`, no request to an audited endpoint on any new page (FR-039)
- [X] T058 [US8] Add to `e2e/clinic-roles.spec.ts` the permanent version of the spike in research R1: open a list, change data elsewhere, return by link and by the back button, and expect the new data

### Implementation

- [X] T059 [US8] Close any gap found by T057 and T058, in the components concerned. Confirm that `src/lib/auth/permissions.test.ts` still agrees with the matrix

**Checkpoint**: Each role sees exactly what the matrix allows.

---

## Phase 11: User Story 9 - A doctor sees their own hours (P3)

**Goal**: A doctor reads their own hours, slots, and time off.

**Independent Test**: Sign in as a synthetic doctor with a schedule, then with none.

### Tests

- [X] T060 [US9] End-to-end tests in `e2e/my-schedule.spec.ts`, in both languages: a schedule, none, no profile, no change controls, and no request to any fee endpoint, confirmed through the fake backend's `/__control/calls`

### Implementation

- [X] T061 [US9] Add `/doctors/me/schedule`, `/slots`, and `/time-off` reads to `src/features/scheduling/api/`, and build `src/app/[locale]/(app)/my/schedule/page.tsx` from the read-only sections. Set `built: true`

**Checkpoint**: All five placeholders named in FR-032 are gone.

---

## Phase 12: Polish and Cross-Cutting

- [X] T062 [P] Add all new screens to `e2e/accessibility.spec.ts`, in both languages and directions, and fix what it finds
- [X] T063 [P] Add session-ending cases to `e2e/live/clinic-setup.spec.ts`: an administrator deactivating an account, setting its password, reactivating it (sign-in works again, and old sessions stay ended), and acting on their own account (SC-008, FR-010). Also a receptionist reading a doctor's page and being refused a forced change with `403` against the real API (constitution VIII)
- [X] T064 Check the new screens at tablet width in both directions, especially the schedule editor, and fix what's found
- [X] T065 Exercise every operation in [contracts/api-usage.md](contracts/api-usage.md) on the running API through the live tests, and record any difference from the contract (SC-002). A material difference stops the work and is reported
- [X] T066 [P] Write `docs/decisions/0011-server-reads-and-refresh.md` from research R1, and add it to `docs/decisions/README.md`
- [X] T067 [P] Update `docs/architecture.md`, `docs/tech-stack.md`, `docs/backend-integration.md`, `docs/frontend-blueprint.md`, `docs/development-guidelines.md`, `docs/roadmap.md` (My schedule belongs to this phase), and `specs/003-auth-app-shell/contracts/app-shell.md`, as listed in the plan
- [ ] T068 Follow the by-hand steps in [quickstart.md](quickstart.md), and time the journey against SC-001
- [X] T069 Run `pnpm check` and `pnpm test:e2e:live`, record the observed results here, then run `/code-review` and resolve its findings
- [ ] T070 Set the spec's status and update `docs/roadmap.md`, after the project owner accepts the phase

---

## Dependencies and Execution Order

```text
Setup → Foundational → US3 specialties → US4 doctors ─┬→ US5 schedule ─┬→ US1 journey → US7 time off → US8 → US9 → Polish
                       US2 staff ───────┘             └→ US6 fees ─────┘
```

- **Foundational** blocks everything.
- **US3 and US2** can run in parallel. **US4** needs both: the doctor form needs specialties, and creating a profile needs accounts.
- **US5 and US6** can run in parallel once US4's page frame exists.
- **US1** needs US5 and US6, as its readiness summary reads both.
- **US7** can start after US5. It comes later only because it's lower priority.
- **US8** checks what's built, so it follows the screens. **US9** reuses the read-only sections of US5 and US7.

## Parallel Example

Once T031 exists:

```text
T033, T034, T035   US5 tests
T040, T041, T042   US6 tests
```

## Implementation Strategy

**MVP**: Through Phase 8. That's the roadmap's done condition, with an administrator able to take a doctor from account to "setup complete". Each phase's checkpoint stops for tests before the next. Commits stay small and focused, per story.

## Results

Recorded as they're observed. The final run covers the code as committed, with the review's fixes.

| Check | Result |
|---|---|
| `pnpm check` at the start (T001) | Passed: 651 unit tests, 270 end-to-end tests |
| Types, lint, formatting, translations, logical styles, contrast, generated types (T069) | Passed |
| Unit tests (T069) | 848 passed, in 61 files |
| End-to-end tests (T069) | 496 passed: 254 and 242, in two shards, because a foreground command is limited to 10 minutes. The `pnpm check` command itself was stopped twice by the system for low memory, so its steps were run one by one |
| Live tests against the real API (T069) | 27 passed. The journey takes about 6 seconds of automated steps in each language |
| `/code-review` (medium) (T069) | 10 findings, all fixed |

An earlier run failed 1 of 493 end-to-end tests, through a real overflow from a long name. Its earlier passes had measured before the page finished streaming, so the test now waits, and the overflow is fixed.

Tests were seen to fail first for the foundations, the specialty form, the schedule, time-off, and fee forms, password clearing, and the review's unit-testable fixes. The staff, doctor, and readiness unit tests, and the end-to-end tests, were written alongside or after their code.

T068 needs a person, for the 5-minute target in SC-001 and the by-hand steps. T070 follows the owner's acceptance.
