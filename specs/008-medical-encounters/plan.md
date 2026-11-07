# Implementation Plan: Medical Encounters

**Branch**: `008-medical-encounters` | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/008-medical-encounters/spec.md`

## Summary

Build the doctor's clinical screens: "My visits", the record for writing, finalizing, reading, and adding addenda, and a patient's history, as a page and as a panel beside a draft. Add the record's status and "Start record" to "My queue".

**The main design point is that clinical content only ever exists in the open page's memory.** No clinical read happens on the server, none goes through the query cache, and nothing typed is kept anywhere. Records and histories are read in the browser, using ADR 0012's guarded read, which moves to a shared place now it has a second feature (R1). Inside the panel, every read happens directly in a click's handler, so no effect can repeat it (R6).

**The second is that typing is the one thing that can be lost, so leaving is guarded.** This is new to the project. Clicks on links are caught in one place, which also covers the language switch, and sign-out and closing the tab are handled too. Whether the browser's back button can be stopped under this version of Next.js is the one assumption not yet measured, so it's the first test written, and the plan names what follows if it fails (R2).

**The third is that a `401` during a change no longer always leaves at once.** `browserApi` ends the session and never answers, which would lose what was typed. Writing a record asks for the answer instead, shows that nothing was saved, and leaves when the person chooses (R5, ADR 0014).

A dedicated privacy review closes the phase, resting on a search for planted text across everywhere clinical content could reach (R12).

## Technical Context

**Language/Version**: TypeScript 5.9.3, Node 24, React 19.3, Next.js 16.4.5 with Cache Components

**Primary Dependencies**: No new dependency. The panel is a plain region, with no sheet or drawer component needed (R6)

**Storage**: None. Nothing clinical is stored in the browser or on the frontend's server

**Testing**: Vitest and Testing Library; Playwright with axe against the production build and the fake backend, which gains encounters; `pnpm test:e2e:live` against the Docker API, with real audit counts and the planted-text search

**Target Platform**: Modern browsers on desktop and tablet, Chromium tested, as in earlier phases

**Project Type**: Web application, frontend with BFF

**Performance Goals**: A save or finalize shows its result as soon as the API answers. Nothing clinical is prefetched or polled. "My queue" adds one unaudited read per 15 seconds while visible

**Constraints**: At most one audited read per person's action. No clinical text in addresses, titles, logs, storage, caches, rendered output, messages, or announcements. Only record and patient numbers in addresses (ADR 0012). Never compare message text. Clinical text exactly as written. WCAG 2.2 AA in both directions

**Scale/Scope**: 3 new pages, 1 new feature, 7 API operations of its own plus 2 reused, 4 changed features or modules (queue, patients, auth, session end), 1 new ADR, and 1 privacy review

## Constitution Check

*GATE: Passed before research. Re-checked after design, with the same result.*

| Principle | Status | How |
|---|---|---|
| I. Backend is source of truth | Pass | Every operation checked in contract `008` and source at `dff2dca`. Completeness and access are the API's alone. The form never decides whether a record can be finalized (FR-015), and offering a history is only a guess the API can overrule. Saves having no version check is recorded as a gap, not worked around |
| II. Security and privacy | Pass | Clinical reads only in the browser, in component state, `no-store` at the route, and cleared by the full page load of sign-out or `401`. Audited reads follow ADR 0012. Nothing typed is stored, accepted with its risk by the owner. Browser features are asked to stay out (R9). Reviewed in writing (R12) |
| III. Role-based UI is UX | Pass | `medicalRecords` is already doctor only. `ScreenGate` on the server, so no read happens for a wrong role. `401`, `403`, and `404` handled on every read and change |
| IV. Feature-based architecture | Pass | New `features/encounters`. "My queue" uses it through `public.ts`. Client Components have a concrete reason: audited reads and typing. The guarded read moves to `lib` now it has a second real consumer |
| V. Strict typing | Pass | Types from generated contracts; response schemas use `satisfies z.ZodType<Generated>` |
| VI. Every state designed | Pass | See [contracts/screens.md](contracts/screens.md). Finalizing and addenda confirm and say what can't be undone. **Starting doesn't confirm**, a reading the owner accepted, in the spec's assumptions |
| VII. Bilingual, accessible | Pass | All text in both files. Statuses translated; clinical text as written, each piece taking its own direction. Axe on every new screen |
| VIII. Tested before done | Pass | See [quickstart.md](quickstart.md), including every role, audit counts, and the planted-text search |
| IX. Simplicity | Pass | No dependency. Only what has a second use moves to shared code. One small option on `browserApi` |
| X. Spec-driven | Pass | Full cycle. ADR 0014 records the new decisions, accepted by the owner |

## Order of Work

1. **The back-button measurement (R2).** A minimal guard and its test, before anything depends on it.
2. **Foundations.** Types and schemas; the pure functions; the API module; the shared guarded read, with patients moved onto it and their live test re-run; `browserApi`'s option; the guard; the fake backend's encounters.
3. **Page shells and access.** All three pages with `ScreenGate`, routes, and messages, so role access can be tested from here on.
4. **Writing.** "Start record" and the record's status on "My queue", then the form, saving, refusals, and the guard.
5. **Finalizing.** The two-step confirmation, refusals, the read-only view, and the finish notice on "My queue".
6. **"My visits".** Filters, states, and row actions.
7. **History.** The page and its rules for offering it.
8. **Panel.** History and earlier records beside the draft.
9. **Addenda.**
10. **Live journey, planted-text search, accessibility, documents.**
11. **Privacy review.** Last, because it rests on everything above running.

## Project Structure

### Documentation (this feature)

```text
specs/008-medical-encounters/
├── spec.md
├── plan.md                  # This file
├── research.md              # Findings and decisions
├── data-model.md            # Entities, states, and conversions
├── quickstart.md            # How to validate, including the live journey
├── contracts/
│   ├── api-usage.md         # API operations, audit effect, and error keys
│   └── screens.md           # Each screen's states
├── privacy-review.md        # Written at the end (FR-045)
└── tasks.md                 # Next step: /speckit-tasks
```

### Source Code

```text
src/
├── app/[locale]/(app)/my/
│   ├── visits/page.tsx                 # Gate, filters from the address, server read of the list
│   ├── encounters/[id]/page.tsx        # Gate, the doctor's own number, EncounterRecord
│   └── patients/[id]/history/page.tsx  # Gate, PatientHistory
├── features/encounters/
│   ├── api/
│   │   ├── encounters.ts               # Browser reads and every change
│   │   └── visits-server.ts            # The list, on the server
│   ├── components/
│   │   ├── encounter-record.tsx        # The reader: decides draft form or read-only view
│   │   ├── encounter-form.tsx          # Fields, save, unsaved notice, guard
│   │   ├── prescription-lines.tsx      # Adding, removing, and each line's fields
│   │   ├── finalize-action.tsx         # Confirmation, save first, finalize
│   │   ├── encounter-view.tsx          # Read only, also used in the panel
│   │   ├── clinical-text.tsx           # As written, with line breaks and its own direction
│   │   ├── addenda.tsx                 # The list and adding one
│   │   ├── visit-list.tsx              # "My visits": filters, states, and rows
│   │   ├── start-record-button.tsx     # Also used by "My queue"
│   │   ├── record-link.tsx             # Guarded link to a record
│   │   ├── history-link.tsx            # Guarded link to a history
│   │   ├── history-list.tsx            # Rows and paging, for page and panel
│   │   ├── patient-history.tsx         # The page's reader
│   │   ├── history-panel.tsx           # Beside the draft: reads only in click handlers
│   │   └── session-ended-notice.tsx    # Nothing saved, and sign in when ready
│   ├── schemas/encounter.ts            # Form values, and response schemas
│   ├── form-values.ts                  # Record to form, form to request, and what counts as changed
│   ├── error-rows.ts                   # A request's line number to the line on screen
│   ├── offered-history.ts              # Whether a history is expected to be allowed
│   ├── opening.ts                      # This feature's marks, on the shared module
│   ├── read-visit-filters.ts           # Address to filters, ignoring what can't be valid
│   ├── types.ts
│   └── public.ts                       # For "My queue"
├── features/queue/components/
│   ├── own-queue.tsx                   # Record status, "Start record", and history links
│   └── own-queue-actions.tsx           # The finish notice
├── features/patients/
│   ├── opening.ts                      # Moves onto the shared module
│   └── components/patient-record.tsx, patient-link.tsx   # Use the shared read and link
├── components/shared/
│   ├── status-badge.tsx                # Gains the `record` kind
│   ├── audited-link.tsx                # Never prefetches, and marks a plain click
│   └── unsaved-changes-guard.tsx       # Warns before leaving, in one place
├── lib/
│   ├── audited-opening.ts              # What was asked for, and what's handed over
│   ├── use-audited-read.ts             # The guarded read, from ADR 0012
│   ├── unsaved-changes.ts              # Whether anything would be lost, and asking first
│   ├── api/browser-api.ts              # Gains the option to answer a `401`
│   ├── auth/session-end.ts             # The guard stands aside when a session really ends
│   └── auth/app-routes.ts              # `built: true`, and two rows
├── features/auth/
│   ├── components/sign-out-button.tsx  # Asks first if anything would be lost
│   └── api/doctor-profile.ts           # Keeps the doctor's own number from its one read
└── messages/{en,ar}.json               # encounters.*

e2e/
├── encounters.spec.ts                  # Screens, states, roles, and the guard on the fake backend
├── accessibility.spec.ts               # Gains the new screens
├── support/fake-clinic.mjs             # Gains encounters
└── live/encounters.spec.ts             # The whole journey, audit counts, and the planted-text search
```

**Structure Decision**: One new feature, matching the backend's module. "My queue" stays in `features/queue` and uses the encounters feature through `public.ts`; the encounters feature doesn't import the queue's, so there's no cycle, and it reads `GET /doctors/me/queue` through its own small read. The guarded read, its marks, and its link move out of `features/patients` because this phase is their second consumer, which is the constitution's own test.

## Decisions to Record

**[ADR 0014](../../docs/decisions/0014-writing-medical-records.md)**, accepted by the owner: saving only by a person's action, the leaving guard, answering a `401` during a change, reading in click handlers in the panel, and the browser-feature hints. It builds on ADRs 0005, 0010, 0012, and 0013.

## Documents to Update

| File | Change |
|---|---|
| `docs/decisions/README.md`, `0005`, `0010`, `0012`, `0013` | ADR 0014 listed, with links. ADR 0013's list of unaudited live reads gains `GET /doctors/me/visits`. ADR 0012's read is now shared |
| `docs/architecture.md` | The encounters feature, and clinical content's path |
| `docs/backend-integration.md` | What the live suite confirms. **H1**: an identical save writes nothing, once observed. **H5**: `encounter_id` comes from visits. **New gap G9**: saves have no version check |
| `docs/frontend-blueprint.md` | Clinical pages as built, the panel, and the rules for offering a history |
| `docs/development-guidelines.md` | How to write a page with unsaved text, and that shared reads have moved |
| `docs/roadmap.md`, `README.md` | Phase status |
| `specs/007-queue/spec.md` | A note on FR-024, pointing to this spec's FR-019 and FR-020 |

## Risks

| Risk | Mitigation |
|---|---|
| The back button can't be stopped under this version of Next.js | Measured first (R2), with a stated fallback, and the owner told if SC-008 has to change |
| A false `encounter.opened` | Permanent live counts for every route to a record, on a production build, as ADR 0012 did. The panel's reads have no effect to repeat |
| Moving the guarded read breaks patients | Moved with no change in behaviour, and `e2e/live/patients.spec.ts`, which measures it, must still pass |
| Clinical text reaches something that outlives the screen | Planted text searched for across every place named in FR-045, on the running API |
| A browser feature or extension reads what's typed | The fields ask them not to (R9). An extension can ignore that, which the privacy review records as beyond the application |
| Text on an unattended screen | Put to the owner in the privacy review. Decision Q2 was made for the front desk |
| A crash loses typing | The owner accepted it. The unsaved notice stays visible, and the review records it |
| A second tab overwrites a draft | New gap G9. After finalizing, the page says if what was locked differs |
| A hidden page holds clinical text in its DOM while the doctor is elsewhere in the application | As ADR 0012 accepts for patients, within one session. Cleared at sign-out by a full page load. The review records it |
| A pasted note over the limit is cut off silently | The fields have no `maxLength`, so nothing is ever cut. The API's `422` decides (R3) |
| Live data accumulates | Dated synthetic data, in the local Docker database only |

## Complexity Tracking

No exceptions to the constitution.
