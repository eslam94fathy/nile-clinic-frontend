# Tasks: Appointments

**Input**: Design documents from `specs/006-appointments/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/api-usage.md](contracts/api-usage.md), [contracts/screens.md](contracts/screens.md), [quickstart.md](quickstart.md)

**Tests**: Required by the constitution (VIII) and the guidelines' testing table. Within a story, tests come first and must fail before the code that satisfies them is written.

**Organization**: By user story, in dependency order rather than number order, following the plan. Access (US8) comes first, because every page needs its gate. Then finding and viewing (US2), because booking ends on an appointment's page. Then booking (US1), the changes (US4, US5, US6), outside availability (US3), which needs rescheduling and cancelling to act on, and the doctor's pages (US7).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: The user story a task belongs to

## Rules for every task

- Check each API detail in [contracts/api-usage.md](contracts/api-usage.md) and `specs/006-appointments/contracts/appointments.openapi.yaml` in the backend repository. Never invent one.
- All text goes in both `src/messages/en.json` and `src/messages/ar.json`, with identical keys.
- **Never call `GET /patients/{id}` to show who's being booked.** Patient calls stay in the browser, in `src/features/patients/api/` (research R2).
- **Links to a record use only `PatientLink`.** Every other link uses `prefetch={false}`.
- **Search terms, notes, and reasons stay in component state.** Never in an address, title, log, or browser storage. A patient appears in an address only as a number.
- **Branch only on status, the error's key, and `reason`.** Never compare message text.
- **Clinic dates and times are never passed through local `Date`.** `end` may be `24:00`.
- **Other features are used only through `public.ts`**, except that `app/` pages may import a feature's server read, as the doctors pages do.
- Response bodies are checked by Zod schemas with `satisfies z.ZodType<Generated>`.
- Logical CSS only. No `any`. Test data is synthetic, including anything typed by hand.
- Tests use role queries. `getByLabel` needs `.locator("visible=true")` after a soft navigation, as hidden pages stay in the DOM.

---

## Phase 1: Setup

- [ ] T001 Confirm that `pnpm check` passes on the branch before any change, and record the result in this file

---

## Phase 2: Foundational (blocks every story)

### Appointment logic

- [ ] T002 [P] Write failing tests, then add `src/features/appointments/types.ts` over `src/lib/api/generated/appointments.ts`, and `src/features/appointments/schemas/appointment.ts` with `schemas/appointment.test.ts`. Response schemas for `AppointmentSummary`, `Appointment`, `OwnAppointmentSummary`, and `OwnAppointment`, using `satisfies z.ZodType<Generated>`. Form schema factories taking translated text: a booking note and a cancellation reason, each trimmed, with `note` at most 500 characters and `reason` at most 255. `toBookingBody` leaves out an empty note, and a cancel body leaves out an empty reason (data-model, FR-001, FR-019)
- [ ] T003 [P] Write failing tests, then implement `src/features/appointments/offered-actions.ts` with `offered-actions.test.ts`: `offeredActions(status, date, start, clinicNow)`. `scheduled` not started gives reschedule and cancel; `scheduled` started gives no-show; `cancelled`, `no_show`, `checked_in`, and `completed` give nothing. Started means `"{date} {start}" <= clinicNow`, by string comparison. Cover the exact minute of the start (FR-021, research R7)
- [ ] T004 [P] Write failing tests, then implement `src/features/appointments/resolve-range.ts` with `resolve-range.test.ts`: `from` or `to` in the address are used as they are. Otherwise, with `patient_id` or `outside_availability`, today to today + 90. Otherwise today only. Cover month and year ends through `addDays` (FR-011, FR-014, research R11)
- [ ] T005 [P] Write failing tests, then implement `src/features/appointments/refusal.ts` with `refusal.test.ts`: `isOutcomeUnknown(error)` is true for status `0` and for `502` and above, and false for `500`. `isAboutTheTime(error)` is true for status `409` and for `422` with a `start` or `date` key, and false otherwise (research R6)

### Shared code, each with its consumer in this phase

- [ ] T006 [P] Write failing tests, then add `src/lib/format/clinic-now.ts` with `clinic-now.test.ts`: `clinicNow(timeZone, now = new Date())` gives `YYYY-MM-DD HH:mm` in that zone, whatever the computer's zone, including midnight as `00:00`, not `24:00` (research R7)
- [ ] T007 [P] Write failing tests in `src/components/shared/filter-bar.test.tsx`, then add an optional per-filter `defaultValue` to `src/components/shared/filter-bar.tsx`: shown when the address has no value, restored on reset, and part of the sync key, because a default can change with other filters. Existing behaviour stays unchanged when it isn't given (research R11)
- [ ] T008 [P] Write failing tests in `src/components/shared/confirm-dialog.test.tsx`, then add an optional `children` slot to `src/components/shared/confirm-dialog.tsx`, between the description and the error (research R8)
- [ ] T009 [P] Add a unit test beside `src/lib/api/use-form-submit.ts`, failing first, then add an optional `onFailure(error)` third argument to `submit`, called after the existing handling. Existing callers are unchanged (research R6)
- [ ] T010 [P] Write a failing test in `src/lib/auth/return-address.test.ts`, then confirm that `safeReturnAddress` gives `/appointments` for `/en/appointments?patient_id=12`, and `/appointments/new` for `/en/appointments/new?patient_id=12`. No code change is expected (FR-031, research R9)

### API modules

- [ ] T011 Write failing tests, then implement `src/features/appointments/api/appointments-server.ts`, with `readAppointments(locale, filters)`, `readAppointment(locale, id)`, `readOwnAppointments(locale, filters)`, and `readOwnAppointment(locale, id)`, all through `readResource` with the schemas from T002. `outside_availability` is only ever sent as `1` (FR-014)
- [ ] T012 Write failing tests, then implement `src/features/appointments/api/appointments.ts` with `appointments.test.ts`: `bookAppointment(body, locale)`, `rescheduleAppointment(id, { date, start }, locale)`, `cancelAppointment(id, reason, locale)`, and `markNoShow(id, locale)`, through `browserApi`. `end` is never sent, and mutations are never retried

### Fake backend

- [ ] T013 Extend `e2e/support/fake-clinic.mjs` with appointments, following its existing style: `GET,POST /appointments`, `GET /appointments/{id}`, `POST .../reschedule`, `/cancel`, `/no-show`, `GET /doctors/me/appointments`, `/{id}`, and `GET /patients?id=N` if it isn't already handled. Booked times leave `slots`. Appointments can be seeded with a passed start and with `outside_availability`. It answers `409` with `slot_booked` and `patient_busy`, `422` under `start` and `appointment`, and counts `GET /patients/{id}`


### Live fixtures

- [ ] T059 Add dedicated synthetic doctors to `e2e/live/setup.ts`, with their accounts in the `LiveAccounts` type in `e2e/live/support.ts`, and deactivated by teardown as the others are: `bookingDoctor` and `secondDoctor`, each with 20-minute appointments and 09:00 to 17:00 hours on all seven days, so that free times exist whatever day the suite runs, and `noShowDoctor`, with no hours until T044 sets them. T023, T035, T039, T041, T044, T047, and T050 use these. Added by `/speckit-analyze`, so its number is out of sequence: it runs here, before Phase 3

---

## Phase 3: User Story 8 - Roles and refusals (P1)

**Goal**: Every appointment address exists behind the right gate, before anything reads.

**Independent test**: Sign in as each role and open every address. Staff addresses refuse a doctor with no read, and doctors' addresses refuse staff.

- [ ] T014 [US8] Write failing cases in `e2e/appointments.spec.ts` for US8: a doctor at `/appointments`, `/appointments/new`, and `/appointments/1`, and staff at `/my/appointments` and `/my/appointments/1`, each get the "not allowed" state with no appointment request. Each role's navigation shows the right entry and no placeholder text
- [ ] T015 [US8] Create shell pages `src/app/[locale]/(app)/appointments/page.tsx`, `src/app/[locale]/(app)/appointments/new/page.tsx`, `src/app/[locale]/(app)/appointments/[id]/page.tsx`, `src/app/[locale]/(app)/my/appointments/page.tsx`, and `src/app/[locale]/(app)/my/appointments/[id]/page.tsx`, each with `Suspense` and `ScreenGate` (paths `appointments` and `my/appointments`), `setRequestLocale`, and a `PageHeader`. Tab titles hold no patient detail. Add first messages under `appointments` in both message files (FR-029, FR-030)
- [ ] T016 [US8] Set `built: true` on `appointments` and `my/appointments` in `src/lib/auth/app-routes.ts`, and update `src/lib/auth/app-routes.test.ts` (FR-029)

**Checkpoint**: T014 passes, and later phases' placeholders are unchanged.

---

## Phase 4: User Story 2 - See and find appointments (P1)

**Goal**: Today's list, every filter except the patient chooser, and an appointment's page.

**Independent test**: With seeded appointments across two doctors and two days, check the default list, each filter with a reload and back, the empty states, and every detail on an appointment's page.

- [ ] T017 [P] [US2] Write failing cases in `e2e/appointments.spec.ts` for US2 scenarios 1, 2, 5 to 9, and 11: default today with every status; filters and page survive a reload and back; a range over 92 days shows the API's message on `to`; empty states from [screens](contracts/screens.md); every detail; "not recorded" and left-out lines; a bad number gives not-found with no API call; a list held in history shows a change made elsewhere
- [ ] T018 [P] [US2] Add `readAllDoctors(locale)` to `src/features/doctors/api/doctors-server.ts`: `per_page=100`, following `last_page`, returning one failed result if any page fails, with a unit test (FR-013, research R4)
- [ ] T019 [US2] Write failing tests, then implement `src/features/appointments/components/appointment-list.tsx` with its test: `FilterBar` with From, To, Doctor, and Status, all `inAddress`, using `defaultValue` from `resolveRange`; doctor options include inactive ones, labelled so; `DataTable` with Date, Time linking to `/appointments/{id}`, Patient, Doctor, and Status with `StatusBadge` kind `appointment`; `pageHref`; empty states by case; `errors` from a `422` on `from`, `to`, `doctor_id`, `status`, and everything else at form level (FR-011, FR-012, FR-015, FR-016, FR-035, FR-036)
- [ ] T020 [US2] Implement `src/app/[locale]/(app)/appointments/page.tsx`: read `searchParams` with `firstParam`, `clinicToday`, `resolveRange`, then `readAppointments` and `readAllDoctors` together, with "Book appointment" in the header. A `403` gives `ForbiddenState`, and a `422` keeps the bar usable (FR-011, FR-030)
- [ ] T021 [US2] Write failing tests, then implement `src/features/appointments/components/appointment-details.tsx` with its test: every field in [data-model](data-model.md); `UserText` for names, notes, and reasons; `ClinicDate`, `ClinicTime`, `Instant`, `LtrText`; `PatientLink` on the name; lines left out as specified; a heading with `tabIndex={-1}` for later focus (FR-016, FR-017, FR-035, FR-036)
- [ ] T022 [US2] Implement `src/app/[locale]/(app)/appointments/[id]/page.tsx`: `readPositiveId`, `readAppointment`, `ApiFailureState`, and "Back to appointments". A `404` shows the neutral state (FR-030)
- [ ] T023 [US2] Add to `e2e/live/appointments.spec.ts`, creating it, using a booking made through the API: the list's fields and page `meta` match the contract, filters match, a range over 92 days gives `422` on `to`, and opening an appointment writes no audit entry. Record what's observed

**Checkpoint**: Reception can find any appointment made through the API.

---

## Phase 5: User Story 1 - Book a patient into a free time (P1)

**Goal**: Booking from either starting point, with every refusal handled.

**Independent test**: Book a synthetic patient into a free time, and confirm the appointment, that the time has gone, and the audit entries.

### Choosers

- [ ] T024 [US1] Extract `src/features/patients/use-patient-search.ts` from `src/features/patients/components/patient-search.tsx`, covering request ordering, the fallback from a page that no longer exists, `403`, and repeating after a change. `patient-search.test.tsx` and `e2e/patients.spec.ts` must pass **unchanged** (research R3)
- [ ] T025 [P] [US1] Add `findPatientById(id, locale)` to `src/features/patients/api/patients.ts`, sending `GET /patients?id=N`, with a test asserting that the path is never `patients/{id}` (FR-003, research R2)
- [ ] T026 [US1] Write failing tests, then implement `src/features/patients/components/patient-chooser.tsx` with its test: the four labelled fields, using the hook; the same keys and rules as search; rows with list fields and a "Choose" button, and no link to a record; an empty result offers "Register a new patient"; `onChoose(patient)`; no browser autofill; search terms gone once a patient is chosen (FR-002, FR-003, FR-010, FR-038, FR-040)
- [ ] T027 [US1] Write failing tests, then implement `src/features/patients/components/chosen-patient.tsx` with its test: reads with `findPatientById` once for a number, shows number, name, and phone, and handles reading, failed with retry, and not found; a `403` removes what's shown and gives `ForbiddenState`, with a refresh so the gate can re-decide; a value that isn't a number makes no request. Export `PatientChooser` and `ChosenPatient` from `src/features/patients/public.ts` (FR-003)
- [ ] T028 [P] [US1] Write failing tests, then add `searchActiveDoctors(terms, page, locale)` to `src/features/doctors/api/doctors.ts`, with `is_active=1`, and implement `src/features/doctors/components/doctor-chooser.tsx` with its test: name field and specialty select, sent to the API with no matching of its own; a first page on mounting; API paging; `specialtyName`; all states; `onChoose(doctor)`. Create `src/features/doctors/public.ts`, exporting `DoctorChooser` and the `DoctorSummary` and `Specialty` types, which the appointments feature needs (FR-004, research R4)
- [ ] T029 [P] [US1] Write failing tests, then implement `src/features/scheduling/free-time-window.ts` with its test: `freeTimeWindow(from, today)` first holds `from` between today and today + 90, so a typed date outside them is never requested, then gives `from`, `to` at `min(from + 6, today + 90)`, and `previous` and `next`, each absent past a limit, and `previous` never before today. Cover a past date, a date beyond the limit, and today + 90 itself (FR-005, research R5)
- [ ] T030 [US1] Write failing tests, then add `src/features/scheduling/api/slots.ts`, and implement `src/features/scheduling/components/free-times.tsx` with its test: a date field, previous and next week, and refresh; one request per window, and the newest answer wins; grouped by the API's `date`; native radios in one group, each named by date and time; controlled `value` and `onChange`; a `refreshSignal` prop that reads again; an `error` prop shown above the times and announced; neutral empty state, offering next week if there is one; failed with retry. No timers. Create `src/features/scheduling/public.ts` (FR-005, FR-006, FR-007, FR-037)

### The form

- [ ] T031 [P] [US1] Write failing cases in `e2e/appointments.spec.ts` for US1: both starting points, each refusal in research R6, an unknown outcome, the form empty on return, and no `GET /patients/{id}` in any of it
- [ ] T032 [US1] Write failing tests, then implement `src/features/appointments/components/booking-form.tsx` with its test: patient, doctor, and time in order, with nothing below offered until the part above is done; "Change" on patient and doctor, where changing the doctor clears the time; the note with the "no medical details" hint and no autofill; `useFormSubmit` with fields `patient_id`, `doctor_id`, `date`, `start`, `note`. On `isAboutTheTime`, signal `FreeTimes` to read again and clear the time. On `patient_busy`, link to `/appointments?patient_id=N&from=D&to=D`. On `isOutcomeUnknown`, say it can't tell, and link to that patient's appointments. On success, toast, reset all state, `router.push` to the appointment, and `router.refresh` (FR-001, FR-008, FR-009, FR-034, FR-038)
- [ ] T033 [US1] Implement `src/app/[locale]/(app)/appointments/new/page.tsx`: `clinicToday`, `readSpecialties`, and `patient_id` from the address through `readPositiveId`. If specialties can't be read, `ApiFailureState` replaces the form, as nothing has been typed yet. A carried patient is chosen when the form is shown, including when a held page is shown again with no patient chosen, and an invalid one shows the search with a message (FR-003, FR-024)
- [ ] T034 [US1] Add "Book appointment" and "View appointments" to `src/features/patients/components/patient-record.tsx`, with `prefetch={false}`, on every view of a record, including just after registering. No further read. Extend `patient-record.test.tsx`, and leave existing cases unchanged (FR-024, FR-025)
- [ ] T035 [US1] Add to `e2e/live/appointments.spec.ts`: booking through the page, the time no longer offered, `appointment.booked` once and `patient.opened` unchanged, including through both patient-page links; two simultaneous bookings give one `201` and one `409` with `slot_booked`, and the page offers another time with nothing retyped; `patient_busy` across two doctors, and `GET /patients?id=N` writes no entry. Record what's observed (SC-002, SC-003)

### Finishing User Story 2's filter, which needs the chooser

- [ ] T036 [US2] Write failing tests, then implement `src/features/appointments/components/appointment-patient-filter.tsx` with its test, and add it to the list page: with `patient_id`, `ChosenPatient` and a "Clear" link; without it, a "Filter by patient" button opening `PatientChooser` in place. Choosing pushes `patient_id`, dropping `from`, `to`, and `page`, so the default range applies. A failed lookup never hides the list. Extend `e2e/appointments.spec.ts` for US2 scenarios 3 and 4, and 10, with no opening written until the link is followed (FR-003, FR-012, FR-017)

**Checkpoint**: The smallest useful clinic workflow works: find or register a patient, book, find it again.

---

## Phase 6: User Story 4 - Reschedule (P2)

**Goal**: Move an appointment to another time with the same doctor, on its own page.

**Independent test**: Reschedule, then confirm the new time, the same number, the old time offered again, and who moved it.

- [ ] T037 [US4] Write failing tests, then implement `src/features/appointments/components/appointment-actions.tsx` with its test: uses `offeredActions`, holds a page-level refusal shown with `FormError`, and moves focus to the heading after a change or refusal. Wire it into the appointment's page with `clinicNow` from the server. "Check in" isn't offered (FR-021, FR-023)
- [ ] T038 [US4] Write failing tests, then implement `src/features/appointments/components/reschedule-panel.tsx` with its test: opens in place with the current date and time visible; `FreeTimes` for the same doctor, with no way to choose another; "Move" and "Cancel", which returns focus. A refusal about the time reads again and clears it, with the same `patient_busy` link. A refusal under `appointment` closes the panel and goes to the page-level refusal, with a refresh. On `isOutcomeUnknown`, it says it can't tell whether the change was saved, and refreshes so that the page shows the truth. On success, toast, close, `router.refresh` (FR-018, FR-022, FR-034)
- [ ] T039 [US4] Extend `e2e/appointments.spec.ts` for US4, and add to `e2e/live/appointments.spec.ts`: same number and patient, old time offered again, `appointment.rescheduled` once, and who moved it shown. Record what's observed

---

## Phase 7: User Story 5 - Cancel (P2)

**Goal**: Cancel with an optional reason, after a warning that it can't be undone.

**Independent test**: Cancel with a reason, then confirm status, reason, and who, and that the time is offered again.

- [ ] T040 [US5] Write failing tests, then implement `src/features/appointments/components/confirmed-change.tsx` with its test, used for cancel with a reason field in `ConfirmDialog`'s `children`: "no medical details" hint, no autofill, at most 255 characters. A refusal under `reason` stays in the dialog on its field. A refusal under `appointment` closes it and goes to the page-level refusal, with a refresh. `403` and `404` refresh. On `isOutcomeUnknown`, it closes, says it can't tell whether the change was saved, and refreshes. One request at a time, with progress in the dialog, so a second press does nothing. On success, it closes, shows a toast, calls `router.refresh`, and moves focus to the heading. Dismissing changes nothing, and returns focus (FR-019, FR-022, FR-034, FR-038, research R6, R8)
- [ ] T041 [US5] Extend `e2e/appointments.spec.ts` for US5, and add to `e2e/live/appointments.spec.ts`: status, reason, and who shown; time offered again; `appointment.cancelled` once; and a reason returned exactly as typed in Arabic. Record what's observed

---

## Phase 8: User Story 6 - Record a no-show (P3)

**Goal**: Mark a no-show once the start has passed, after a warning.

**Independent test**: Mark an appointment whose start has passed, then force the action on one that hasn't started.

- [ ] T042 [US6] Write failing tests, then use `ConfirmedChange` for no-show in `appointment-actions.tsx`: offered only once started, says it can't be undone, and refusals and an unknown outcome behave as in T040 (FR-020, FR-021, FR-034)
- [ ] T043 [US6] Extend `e2e/appointments.spec.ts` for US6, using seeded passed starts and a forced refusal
- [ ] T044 [US6] Add to `e2e/live/appointments.spec.ts`, as research R10 describes, using `noShowDoctor` from T059: 5-minute appointments today from the next 5-minute boundary at least one minute away; book that slot; no-show forced before the start gives `422` on `appointment`, shown at page level; wait for the start; mark through the page; `appointment.no_show` once. Its own timeout, and a stated skip in the clinic's last minutes. Record what's observed

---

## Phase 9: User Story 3 - Outside availability (P2)

**Goal**: Flagged appointments can be seen, found, and dealt with.

**Independent test**: Record time off over a booking, find it in "Needing a move", reschedule it, and see it leave that view.

- [ ] T045 [US3] Write failing tests, then implement `src/features/appointments/components/appointment-view-links.tsx` with its test: "All" and "Needing a move", `aria-current` on the current one, dropping `from`, `to`, and `page`, keeping `doctor_id` and `patient_id`. Add it to the list page, with the text label in the Status column (FR-011, FR-014)
- [ ] T046 [US3] Add the notice to `appointment-details.tsx`: the appointment still stands, the patient isn't told automatically, and it should be moved or cancelled, as text, not color alone. Extend its test
- [ ] T047 [US3] Extend `e2e/appointments.spec.ts` for US3, and add to `e2e/live/appointments.spec.ts`: time off covering a booking shows the label, the view finds it, and moving it removes it. Record what's observed (SC-004)

---

## Phase 10: User Story 7 - A doctor's own appointments (P2)

**Goal**: Doctors see who's booked with them, read-only.

**Independent test**: As a doctor, see only their own, with no phone and no actions, and get not-found for another doctor's.

- [ ] T048 [US7] Write failing tests, then implement `src/features/appointments/components/own-appointment-list.tsx` and `own-appointment-details.tsx`, with their tests: columns and fields from [screens](contracts/screens.md), sex translated, no phone, no patient link, no actions, and today by default (FR-026, FR-027)
- [ ] T049 [US7] Implement `src/app/[locale]/(app)/my/appointments/page.tsx` and `[id]/page.tsx`: filters From, To, and Status in the address, and `ApiFailureState`, with the gate handling no profile (FR-026, FR-028)
- [ ] T050 [US7] Extend `e2e/appointments.spec.ts` for US7, including no profile, and add to `e2e/live/appointments.spec.ts`: only their own appear, another doctor's is not-found, and a forced staff action gives `403`. Record what's observed

---

## Phase 11: Polish

- [ ] T051 [P] Add the new screens to `e2e/accessibility.spec.ts`: the list with each empty state and a refusal, each booking step and refusal, an appointment's page with the panel and both dialogs open, and the doctor's pages, in both languages and both themes (SC-009)
- [ ] T052 Add keyboard-only cases and no-sideways-scroll checks at 768px and 390px to `e2e/appointments.spec.ts`, in both languages, for booking, rescheduling, cancelling, and marking a no-show (SC-009)
- [ ] T053 Add a role changed mid-session and a session ended elsewhere to `e2e/appointments.spec.ts`, on the list, booking, each action, and the doctor's pages. A `403` removes patient details from the screen (FR-030, US8 scenarios 3 and 4)
- [ ] T054 Add to `e2e/live/appointments.spec.ts`: after a full journey and sign-out, no synthetic term, note, or reason in any address visited, in storage, on the page reached by going back, or in the application server's output, and timing guards for SC-001 and SC-004. Record what's observed (FR-032, FR-039, SC-005)
- [ ] T055 Search `src/features/appointments`, and the new files in other features: no logging, no browser storage, no `GET /patients/{id}`, no compared message text, no `new Date` on a clinic date, no hard-coded text, and no check-in. Record the result
- [ ] T056 Update the documents listed in [plan.md](plan.md): `docs/frontend-blueprint.md`, including check-in moving to `/queue`; `docs/backend-integration.md`, with only what's observed; `docs/architecture.md`; `docs/development-guidelines.md`; `docs/roadmap.md`; and a note on FR-032 in `specs/005-patients/spec.md`
- [ ] T057 Run `pnpm check` and `pnpm test:e2e:live`, record the results, and run the manual scenarios in [quickstart.md](quickstart.md) with the owner, recording which were done by a person
- [ ] T058 Run `/code-review` on the branch, resolve the findings, then run the checks in T057 again and record the results

---

## Dependencies

```text
Setup → Foundational → US8 → US2 → US1 → US4 → US5 → US6 → US3 → US7 → Polish
```

- **US8** first, as every page needs its gate.
- **US2** before **US1**, because booking ends on the appointment's page. T036 finishes US2 after US1's chooser exists.
- **US4** adds `AppointmentActions`, which **US5** and **US6** extend. **US6** reuses `ConfirmedChange` from **US5**.
- **US3** after **US4** and **US5**, since it needs them to act on.
- **US7** needs only Foundational and US8, so it can move earlier or run alongside.

## Parallel Examples

- **Foundational**: T002 to T010 touch different files, and can all run together. T011 and T012 need T002. T059 can run alongside them.
- **US1 choosers**: T025, T028, and T029 can run together. T026 and T027 need T024 and T025, and T030 needs T029.
- **Polish**: T051 can run alongside T052 and T053, which add to one file, so run those two in turn.

## Implementation Strategy

**Smallest useful increment**: Phases 1 to 5, covering US8, US2, and US1. Reception can book, and find appointments again. Changes wait for US4 and US5, so until then a mistake can't be fixed from the application.

**What Phase 7 of the roadmap needs**: through US5 here, as check-in starts from a scheduled appointment.

**Phase complete**: all stories and polish, with T057 and T058 passed, and the owner's acceptance recorded.

**Stop and report if** any live count of `patient.opened` differs from what a person asked for, or the API differs from the contract. Either would mean the design's basis has changed.

## Results

Filled in as tasks run. Only observed results.

| Task | Result |
|---|---|
