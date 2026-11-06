# Implementation Plan: Appointments

**Branch**: `006-appointments` | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-appointments/spec.md`

## Summary

Build reception's appointment list, booking, an appointment's page with reschedule, cancel, and no-show, and a doctor's read-only pages. Add two links from the patient's page.

**The main design point is what doesn't need Phase 5's care.** Reading appointments and free times writes no audit entry, verified in the backend's source, so lists and appointment pages use ADR 0011's server reads and refresh. The audit risk is confined to one place: choosing a patient. That always uses the unaudited list read, including `GET /patients?id=N` for a patient carried by number, and never `GET /patients/{id}` (R2).

The other main concern is that a time can be taken at any moment, and that free times leave out the doctor's bookings but not the patient's. So the API's refusal is an ordinary path, with patient, doctor, and note surviving it (R6). When the outcome of a booking is unknown, the screen says so (R6).

## Technical Context

**Language/Version**: TypeScript 5.9.3, Node 24, React 19.3, Next.js 16.4.5 with Cache Components

**Primary Dependencies**: None added. `react-hook-form`, `zod`, and `sonner` are already installed. `@tanstack/react-query` stays uninstalled until Phase 7

**Storage**: None. Choices and typed text are held in component state only. No browser storage

**Testing**: Vitest and Testing Library; Playwright with axe against the production build and the fake backend, which gains appointments; `pnpm test:e2e:live` against the Docker API, including audit counts and a real no-show

**Target Platform**: Modern browsers on desktop and tablet, Chromium tested, as in earlier phases

**Project Type**: Web application, frontend with BFF

**Performance Goals**: A booking of a known patient takes under one minute. One request for each week of free times. Nothing is polled or prefetched

**Constraints**: No patient record read while choosing. No search terms, notes, or reasons in addresses, titles, logs, or browser storage; a patient number may appear in an address (ADR 0012). Clinic dates and times never pass through local `Date`. Never compare message text. WCAG 2.2 AA in both directions

**Scale/Scope**: 5 new pages, 1 new feature, 8 API operations of its own plus 4 reused, 1 changed page, and 4 small changes to shared code

## Constitution Check

*GATE: Passed before research. Re-checked after design, with the same result.*

| Principle | Status | How |
|---|---|---|
| I. Backend is source of truth | Pass | Every operation checked in the contract and source. Free times, conflicts, and name matching stay in the API. `offeredActions` only decides what's offered, and the API's refusal wins (R7) |
| II. Security and privacy | Pass | Choosing a patient never reads the record. Search terms stay in state. Only a patient number enters an address, as ADR 0012 allows. Autofill off. Tab titles fixed. Sign-out's full page load clears memory. Return after sign-in drops the query (R9) |
| III. Role-based UI is UX | Pass | `manageAppointments` and `readOwnAppointments` are already in the role map. `ScreenGate` on the server, so no read happens for a wrong role. `401`, `403`, `404` handled on every read and action |
| IV. Feature-based architecture | Pass | New `features/appointments`. It uses other features only through `public.ts`: `PatientChooser`, `ChosenPatient`, and `PatientLink`; `DoctorChooser`; `FreeTimes`. Client Components have a concrete reason: interaction, or private state |
| V. Strict typing | Pass | Types from generated contracts; response schemas use `satisfies z.ZodType<Generated>` |
| VI. Every state designed | Pass | See [contracts/screens.md](contracts/screens.md). Cancel and no-show confirm and say they can't be undone. Booking and rescheduling don't, as they can be corrected, following ADR 0012's reasoning |
| VII. Bilingual, accessible | Pass | All text in both files. Statuses translated; names, notes, and reasons as written. Free times are native radios. Axe on every new screen |
| VIII. Tested before done | Pass | See [quickstart.md](quickstart.md), including every role and a real no-show |
| IX. Simplicity | Pass | No dependency. Each shared change has a real consumer here. The patient search hook has two (R3) |
| X. Spec-driven | Pass | Full cycle. No new ADR: this applies ADRs 0011 and 0012 and decides nothing new about the architecture |

## Order of Work

1. **Foundations.** Types and schemas, the pure functions, the API modules, `clinicNow`, the shared changes, and the fake backend's appointments.
2. **Page shells and access.** All five pages with `ScreenGate`, `built: true`, and messages. Role access can be tested from here on.
3. **List.** Filters, defaults, views, states. Everything else links to or from it.
4. **Appointment's page, showing.** All details and states, with `offeredActions`.
5. **Choosers.** The patient search hook extraction first, with `PatientSearch`'s tests unchanged. Then `PatientChooser`, `ChosenPatient`, `DoctorChooser`, `FreeTimes`.
6. **Booking.** The form, refusals, unknown outcome, and the patient's page links. The list's patient filter.
7. **Changes.** Reschedule, cancel, and no-show, with page-level refusals and focus.
8. **Doctor's pages.**
9. **Live journey, accessibility, documents.**

## Project Structure

### Documentation (this feature)

```text
specs/006-appointments/
├── spec.md
├── plan.md                  # This file
├── research.md              # Findings and decisions
├── data-model.md            # Entities, states, filters, and conversions
├── quickstart.md            # How to validate, including the live journey
├── contracts/
│   ├── api-usage.md         # API operations, audit effect, and error keys
│   └── screens.md           # Each screen's states
└── tasks.md                 # Next step: /speckit-tasks
```

### Source Code

```text
src/
├── app/[locale]/(app)/
│   ├── appointments/
│   │   ├── page.tsx                  # Gate, range, list and doctors read on the server
│   │   ├── new/page.tsx              # Gate, clinic's today, specialties, BookingForm
│   │   └── [id]/page.tsx             # Gate, readPositiveId, details and actions
│   └── my/appointments/
│       ├── page.tsx                  # Gate and the doctor's list
│       └── [id]/page.tsx             # Gate and the doctor's details
├── features/appointments/
│   ├── api/
│   │   ├── appointments-server.ts    # Reads, for pages
│   │   └── appointments.ts           # Book, reschedule, cancel, no-show, from the browser
│   ├── components/
│   │   ├── appointment-list.tsx      # Staff table, filters, and states
│   │   ├── appointment-view-links.tsx    # "All" and "Needing a move"
│   │   ├── appointment-patient-filter.tsx
│   │   ├── appointment-details.tsx
│   │   ├── appointment-actions.tsx   # What's offered, and page-level refusals
│   │   ├── confirmed-change.tsx      # Cancel and no-show
│   │   ├── reschedule-panel.tsx
│   │   ├── booking-form.tsx
│   │   ├── own-appointment-list.tsx
│   │   └── own-appointment-details.tsx
│   ├── schemas/appointment.ts        # Response and form schemas
│   ├── offered-actions.ts
│   ├── resolve-range.ts
│   ├── refusal.ts                    # isOutcomeUnknown, and whether a refusal is about the time
│   └── types.ts
├── features/patients/
│   ├── use-patient-search.ts         # Extracted from PatientSearch
│   ├── components/patient-chooser.tsx
│   ├── components/chosen-patient.tsx # Reads by list, never the record
│   ├── components/patient-search.tsx # Now uses the hook
│   ├── components/patient-record.tsx # Gains the two links
│   ├── api/patients.ts               # Gains findById
│   └── public.ts                     # Gains PatientChooser and ChosenPatient
├── features/doctors/
│   ├── components/doctor-chooser.tsx
│   ├── api/doctors.ts                # Gains searchActiveDoctors
│   ├── api/doctors-server.ts         # Gains readAllDoctors
│   └── public.ts                     # New: DoctorChooser
├── features/scheduling/
│   ├── components/free-times.tsx
│   ├── free-time-window.ts
│   ├── api/slots.ts                  # Browser read
│   └── public.ts                     # New: FreeTimes
├── components/shared/
│   ├── filter-bar.tsx                # Gains a per-filter defaultValue
│   └── confirm-dialog.tsx            # Gains an optional children slot
├── lib/api/use-form-submit.ts        # Gains an optional onFailure
├── lib/format/clinic-now.ts
├── lib/auth/app-routes.ts            # `built: true` on two routes
└── messages/{en,ar}.json             # appointments.*

e2e/
├── appointments.spec.ts              # Screens, states, and roles on the fake backend
├── accessibility.spec.ts             # Gains the new screens
├── support/fake-clinic.mjs           # Gains appointments
└── live/
    ├── appointments.spec.ts          # The whole journey, audit counts, real no-show
    └── setup.ts                      # Gains a dedicated synthetic doctor
```

**Structure Decision**: One new feature, matching the backend's module. Choosers and free times belong to the feature that owns their data, and are exposed through `public.ts`, as `PatientLink` already is. `app/` pages import each feature's server read directly, as the doctors pages do.

## Decisions to Record

No new ADR. Lists and pages follow ADR 0011. Choosing a patient follows ADR 0012, including its rule that no patient API call runs on the server. Skipping confirmation on booking and rescheduling follows ADR 0012's reading of Principle VI, and is recorded in the spec's assumptions.

## Documents to Update

| File | Change |
|---|---|
| `docs/frontend-blueprint.md` | Appointment pages as built. **Check-in moves to `/queue`, in Phase 7**. Status line |
| `docs/backend-integration.md` | What the live suite confirms about appointments, including free times leaving out only the doctor's bookings, and `GET /patients?id=N` being unaudited |
| `docs/architecture.md` | Add the appointments feature, and the rule that choosing a patient never reads the record |
| `docs/development-guidelines.md` | Use `PatientChooser` and `ChosenPatient` to show a patient without opening them |
| `docs/roadmap.md` | Phase status |
| `specs/005-patients/spec.md` | A note on FR-032, pointing to this spec's FR-024 |

## Risks

| Risk | Mitigation |
|---|---|
| A later screen shows a patient by reading the record, writing a false opening | `ChosenPatient` is the exported way. The live test counts `patient.opened` through the whole journey |
| Extracting the search hook changes `PatientSearch` | Its tests and the live opening test must pass unchanged |
| Today's list exposes names and phones on a shared screen | The owner's decision, for daily work. Only signed-in reception sees it, and sign-out clears it |
| An old page offers an action that's no longer possible | The API refuses, the message shows at page level, and the page refreshes |
| The clinic's clock in the frontend differs from the backend's | H4, an existing deployment concern. Only what's offered could differ, and the API decides |
| The no-show live test takes up to about six minutes, and can't run in the last minutes of the clinic's day | It has its own timeout, and skips with a stated reason. Refusal and display are covered quickly on the fake backend |
| Reading every doctor for the filter grows with the number of doctors | Pages of 100; a single clinic won't approach many pages |
| Live data accumulates, as appointments can't be deleted | Runs use dated synthetic data, in the local Docker database only |
| Audit addresses stay wrong until the backend change | Existing production blocker H2, unchanged |

## Complexity Tracking

No exceptions to the constitution.
