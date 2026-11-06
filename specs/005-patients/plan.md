# Implementation Plan: Patients

**Branch**: `005-patients` | **Date**: 2026-11-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-patients/spec.md`

## Summary

Build three screens for administrators and receptionists: find a patient, register one, and view and correct one's record. Each read of a record writes a permanent audit entry, so the design's main job is to read only when a person asks.

**The main decision comes from measurement.** A production-build spike, counting real `patient.opened` entries, showed that reading the record on the server writes a false entry when someone saves anything on another page and then presses back. So patient records and search are read in the browser, with the record held in component state, as a narrow exception to ADR 0011. See [research.md](research.md), R1 to R4.

Reading the backend's source also showed that a `PATCH` changing nothing writes `patient.opened`, and that a search with no filters lists every patient. Both become requirements on the form and the search (R6).

## Technical Context

**Language/Version**: TypeScript 5.9.3, Node 24, React 19.3, Next.js 16.4.5 with Cache Components

**Primary Dependencies**: None added. `react-hook-form`, `zod`, and `sonner` are already installed. `@tanstack/react-query` stays uninstalled until Phase 7

**Storage**: None. A small in-memory module holds a just-registered record until it's shown, asked-for marks, and a change counter. No browser storage

**Testing**: Vitest and Testing Library; Playwright with axe against the production build and the fake backend, which gains patients; `pnpm test:e2e:live` against the Docker API, including the opening counts

**Target Platform**: Modern browsers on desktop and tablet, Chromium tested, as in earlier phases

**Project Type**: Web application, frontend with BFF

**Performance Goals**: Opening a record makes exactly one patient read. Search makes one request per submission. Nothing is requested by prefetching, hovering, or typing

**Constraints**: Audited reads only from a person's action. No patient details in addresses, titles, logs, or browser storage. Clinic dates are never passed through `Date`. Stored text is never altered. Never compare message text. WCAG 2.2 AA in both directions

**Scale/Scope**: 3 pages, 1 feature, 4 API operations, 3 small changes to shared components

## Constitution Check

*GATE: Passed before research. Re-checked after design, with the same result.*

| Principle | Status | How |
|---|---|---|
| I. Backend is source of truth | Pass | All operations checked in contract `patients` and in source. Arabic matching stays entirely in the API. The duplicate check only displays the API's answer, and the API still decides what can be registered |
| II. Security and privacy | Pass | Search terms exist only in state and the API's query string, the constitution's one exception. Audited reads have measured triggers. Autofill off. Tab titles fixed. Full-page sign-out clears memory |
| III. Role-based UI is UX | Pass | `managePatients` in the role map; `ScreenGate` on the server, so a doctor gets no content; `401`, `403`, `404` handled on every read and action |
| IV. Feature-based architecture | Pass | `features/patients`, with `api/`, `components/`, `schemas/`. Other phases use only `public.ts`. Client Components have a concrete reason: holding audited or private state |
| V. Strict typing | Pass | Types from generated contracts; response schemas use `satisfies z.ZodType<Generated>` |
| VI. Every state designed | Pass | See [contracts/screens.md](contracts/screens.md), including failure of a repeat read and of the duplicate check |
| VII. Bilingual, accessible | Pass | All text in both files. Sex translated; names and addresses as stored, in their own direction. Axe on every new screen |
| VIII. Tested before done | Pass | See [quickstart.md](quickstart.md). The spike's measurements become a permanent live test |
| IX. Simplicity | Pass | No dependency. No client cache. No search library. Shared changes each have a real consumer here |
| X. Spec-driven | Pass | Full cycle. One new ADR below |

## Order of Work

1. **Foundations.** Patient types and schemas, `form-values.ts`, `opening.ts`, the API module, the fake backend's patients and its request counter, and the three shared component changes.
2. **Page shells and access.** The three pages with `ScreenGate`, `built: true`, and messages. Doctor access can be tested from here on.
3. **Record page, showing.** The reader, `PatientLink`, and every state. This is the audited core, so it comes before anything links to it. The live opening test starts here.
4. **Search.** Fields, results, paging, and states.
5. **Register.** Form, handed-over record, then the duplicate check.
6. **Edit.** In-place form, changes only, and the results update.
7. **Live journey, accessibility, documents.**

## Project Structure

### Documentation (this feature)

```text
specs/005-patients/
├── spec.md
├── plan.md                  # This file
├── research.md              # Measured evidence and decisions
├── data-model.md            # Entities, conversions, and state flows
├── quickstart.md            # How to validate, including the opening count
├── contracts/
│   ├── api-usage.md         # API operations, audit effect, and error keys
│   └── screens.md           # Each screen's states
└── tasks.md                 # Next step: /speckit-tasks
```

### Source Code

```text
src/
├── app/[locale]/(app)/patients/
│   ├── page.tsx                      # Gate and PatientSearch
│   ├── new/page.tsx                  # Gate and RegisterPatient, with the clinic's today
│   └── [id]/page.tsx                 # Gate, readPositiveId, and PatientRecord
├── features/patients/
│   ├── api/patients.ts               # The only network code; browser only
│   ├── components/
│   │   ├── patient-search.tsx        # Terms, page, and results in state
│   │   ├── patient-link.tsx          # prefetch off; a plain click marks the record
│   │   ├── patient-record.tsx        # The reader: states and read triggers
│   │   ├── patient-details.tsx       # The record as a list
│   │   ├── patient-fields.tsx        # Fields shared by register and edit
│   │   ├── patient-edit-form.tsx
│   │   ├── register-patient.tsx      # Form and the duplicate check's flow
│   │   └── possible-matches.tsx
│   ├── schemas/patient.ts            # Form and response schemas
│   ├── form-values.ts                # Record to form, form to body, form to changes
│   ├── opening.ts                    # Handed record, marks, change counter
│   ├── types.ts
│   └── public.ts                     # PatientLink, for later phases
├── features/auth/
│   ├── components/api-failure-state.tsx  # Gains onRetry
│   └── public.ts                     # Exports ApiFailureState for client use
├── components/shared/
│   ├── filter-bar.tsx                # Gains errors; autofill off on private filters
│   └── data-table.tsx                # Pagination gains onPage
├── lib/auth/app-routes.ts            # `built: true` on patients
└── messages/{en,ar}.json             # patients.*

e2e/
├── patients.spec.ts                  # Screens, states, and roles on the fake backend
├── accessibility.spec.ts             # Gains the new screens
├── support/fake-clinic.mjs           # Gains patients, and counts record reads
└── live/patients.spec.ts             # The opening counts and the whole journey
```

**Structure Decision**: One feature, matching the backend's module. No `*-server.ts` API file, deliberately, so that an audited read can't be added on the server by accident. A check in `scripts/`, in the style of the project's other checks, could enforce this, but the live opening test already fails if it happens, so none is added.

## Decisions to Record

| Document | Content |
|---|---|
| ADR 0012, audited reads in the browser | Records and patient search are read by Client Components, as an exception to ADR 0011, covering only audited reads and private search terms. Includes the measured table, the asked-for mark, and the handed-over record. **Reverses ADR 0005's rejection of fetching audited records outside TanStack Query**, on that evidence, and clarifies what "bare `useEffect`" means in ADR 0005 and ADR 0006. Also records two readings of the constitution: the patient number is an opaque identifier and not a patient detail, so it may appear in an address (Principle II); and registering isn't an irreversible action, because details can be corrected by editing (Principle VI). Later audited reads (Phases 8 and 11) should start from it |

## Documents to Update

| File | Change |
|---|---|
| `docs/architecture.md` | "Reading in a Client Component" now has a user. Add the audited-read flow, and the patients feature |
| `docs/backend-integration.md` | Findings from research R6, and confirmation of the patient operations on the running API |
| `docs/frontend-blueprint.md` | Patient pages as built; status line |
| `docs/decisions/README.md` | ADR 0012 |
| `docs/decisions/0005-audit-safe-data-fetching.md`, `0006-cache-components.md` | Add a pointer to ADR 0012 where they say Phase 5 must test these behaviours |
| `docs/development-guidelines.md` | `PatientLink` is the only link to a record. Patient reads have no server path |
| `docs/roadmap.md` | Phase status |

## Risks

| Risk | Mitigation |
|---|---|
| A later Next.js version changes when held pages keep state or re-run effects | The live opening test fails, and it runs on the production build |
| Another phase links to a record without `PatientLink`, so a repeat click shows the held copy | `public.ts` offers only `PatientLink`, and guidelines require it. Even then, no false entry can result, only a missing repeat, so the failure is the safer one |
| Going back after the page is no longer held writes an entry | It's a person asking to see the record, so it's true. The spec records this, and the live test doesn't assert how long pages are held |
| Language switch writes an entry | Also true, and recorded in the spec. Handing the record across would add complexity for a rare action |
| A long-held record is out of date | Accepted by ADR 0005. "Last changed" is shown, and "Reload details" and a repeat click both read afresh |
| The record is in memory on a shared computer, while the person's signed in | Same as every hidden page. Sign-out's full page load clears it, already tested in Phase 3, and tested for patients here |
| A malicious link to `/patients/5` writes a true-looking entry against whoever clicks it | The person did open that record. Sign-in never returns to one, and the same-origin route refuses non-JSON requests. Accepted |
| Live test data accumulates, as patients can't be deleted | Runs use dated synthetic names, in the local Docker database only |
| Audit addresses stay wrong until the backend change | Existing production blocker H2, unchanged |

## Complexity Tracking

| Exception | Why needed | Simpler alternative rejected because |
|---|---|---|
| Client read, against ADR 0011's default | A server read writes false audit entries after any refresh (R1, measured). Search terms can't reach a Server Component without entering the address (R4) | Server reads fail FR-014 and the constitution's Principle II |
