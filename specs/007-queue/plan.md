# Implementation Plan: Queue

**Branch**: `007-queue` | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-queue/spec.md`

## Summary

Build reception's live Queue page, the walk-in form, check-in on an appointment's page, and the doctor's "My queue" with call next and finish. Add one link from the patient's page.

**The main design point is that this is the first screen that reads by itself.** Queue reads write no audit entry, verified in the backend's source, so they may poll. They run in the browser through TanStack Query, under a `live` policy, with the provider only on the queue's pages (R1, R2, ADR 0013). Everything else keeps ADR 0011's server reads and refresh, including check-in on the appointment's page.

**The second is that a list changing under someone must not disturb them.** Confirmations sit above the rows, so a refresh that changes or removes a row can't close one (R5). A failed refresh keeps the last list with a notice. A `401`, `403`, or `404` stops reading and removes patient details (R3).

Whether polling really stops on a page Next.js keeps hidden is the one assumption not yet measured. It's the first test written, and the plan names what follows if it fails (R2).

## Technical Context

**Language/Version**: TypeScript 5.9.3, Node 24, React 19.3, Next.js 16.4.5 with Cache Components

**Primary Dependencies**: Adds `@tanstack/react-query` at 5.106.1, as planned in `docs/tech-stack.md` and ADRs 0005 and 0011. The queue's polling is the need it was waiting for

**Storage**: None. The query cache is memory only, and is never persisted

**Testing**: Vitest and Testing Library; Playwright with axe against the production build and the fake backend, which gains the queue, using Playwright's clock for the 15 seconds; `pnpm test:e2e:live` against the Docker API, including audit counts and real two-computer refreshing

**Target Platform**: Modern browsers on desktop and tablet, Chromium tested, as in earlier phases

**Project Type**: Web application, frontend with BFF

**Performance Goals**: One read per visible list every 15 seconds, and none when hidden. A change appears on another computer within 20 seconds. Nothing is prefetched

**Constraints**: No patient record read on these pages. No search terms in addresses, titles, logs, or browser storage; patient and doctor numbers may appear in an address (ADR 0012). Instants in the clinic's time zone. Never compare message text. WCAG 2.2 AA in both directions

**Scale/Scope**: 3 new pages, 1 new feature, 9 API operations of its own plus 5 reused, 2 changed features, 2 small shared changes, and 1 new dependency

## Constitution Check

*GATE: Passed before research. Re-checked after design, with the same result.*

| Principle | Status | How |
|---|---|---|
| I. Backend is source of truth | Pass | Every operation checked in the contract and source. Order, who's next, and every refusal stay in the API. `offeredActions` and the row rules only decide what's offered, and the API wins |
| II. Security and privacy | Pass | Queue reads aren't audited, and the live suite confirms it. No read of a patient's record on these pages. Terms stay in state. Cache in memory only, and cleared by sign-out's and `401`'s full page load. Patient details removed on `403` (R3) |
| III. Role-based UI is UX | Pass | `manageQueue` and `ownQueue` are already in the role map. `ScreenGate` on the server, so no read happens for a wrong role. `401`, `403`, `404` handled on every read, refresh, and action |
| IV. Feature-based architecture | Pass | New `features/queue`. It uses other features only through `public.ts`. Client Components have a concrete reason: polling and interaction |
| V. Strict typing | Pass | Types from generated contracts; response schemas use `satisfies z.ZodType<Generated>` |
| VI. Every state designed | Pass | See [contracts/screens.md](contracts/screens.md). Left, undo, call next, and finish confirm and say what can't be undone. Check-in and a walk-in don't, as they can be corrected, and the walk-in form says so first |
| VII. Bilingual, accessible | Pass | All text in both files. Statuses translated; names as written. Refreshes aren't announced; a person's own results are. Axe on every new screen |
| VIII. Tested before done | Pass | See [quickstart.md](quickstart.md), including every role and refusals during a refresh |
| IX. Simplicity | Pass | One dependency, with its reason recorded. The policy holds only the `live` kind, as nothing else uses it yet. Each shared change has a real consumer here |
| X. Spec-driven | Pass | Full cycle. ADR 0013 records how live reads work, accepted by the owner |

## Order of Work

1. **Foundations.** Install the dependency; types and schemas; the pure functions; the API module; the shared changes; the fake backend's queue.
2. **The hidden-page measurement (R2).** A minimal live list and its test, before anything is built on it.
3. **Page shells and access.** All three pages with `ScreenGate`, `built: true`, and messages. Role access can be tested from here on.
4. **Reception's list.** Grouping, filters, states, last-read time, and failed refreshes.
5. **Check-in.** On the appointment's page, with the link to the list.
6. **Corrections.** Left and undo, with the dialog above the rows.
7. **Doctor's list.** Current patient, call next, and finish.
8. **Walk-in.** The form, refusals, and the patient's page link.
9. **Live journey, accessibility, documents.**

## Project Structure

### Documentation (this feature)

```text
specs/007-queue/
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
│   ├── queue/
│   │   ├── page.tsx                  # Gate, filters from the address, every doctor for the filter
│   │   └── walk-in/page.tsx          # Gate, specialties, WalkInForm
│   └── my/queue/page.tsx             # Gate and OwnQueue
├── features/queue/
│   ├── api/queue.ts                  # Browser reads and every action
│   ├── hooks/use-live-list.ts        # The live query, what stops it, and the last-read time
│   ├── components/
│   │   ├── live-query-provider.tsx   # Only on these pages
│   │   ├── last-read.tsx             # Last read, refresh now, and the out-of-date notice
│   │   ├── clinic-queue.tsx          # Reception: filters, states, and groups
│   │   ├── queue-group.tsx           # One doctor's rows
│   │   ├── entry-action-dialog.tsx   # Left and undo, above the rows
│   │   ├── own-queue.tsx             # Doctor: current patient, actions, and list
│   │   ├── own-queue-actions.tsx     # Call next and finish
│   │   └── walk-in-form.tsx
│   ├── schemas/queue.ts              # Response schemas
│   ├── group-by-doctor.ts
│   ├── offered-entry-actions.ts      # What a row offers
│   ├── offered-own-action.ts         # Call next, finish, or neither
│   ├── apply-entry.ts                # Puts an action's answer into the list on screen
│   ├── read-queue-filters.ts         # Address to filters, ignoring what can't be valid
│   ├── types.ts
│   └── public.ts                     # checkInAppointment
├── features/appointments/
│   ├── offered-actions.ts            # Gains check_in
│   ├── components/appointment-actions.tsx    # Gains check-in and the link to the list
│   └── refusal.ts                    # Keeps isAboutTheTime only
├── features/patients/components/patient-record.tsx    # Gains the third link
├── components/shared/confirm-dialog.tsx      # `trigger` becomes optional
├── lib/api/
│   ├── refusal.ts                    # isOutcomeUnknown and allMessages, moved from appointments
│   └── live-query.ts                 # The `live` policy, ADR 0005's single module
├── lib/auth/app-routes.ts            # `built: true` on two routes
└── messages/{en,ar}.json             # queue.*

e2e/
├── queue.spec.ts                     # Screens, states, roles, and refreshing on the fake backend
├── accessibility.spec.ts             # Gains the new screens
├── support/fake-clinic.mjs           # Gains the queue
└── live/queue.spec.ts                # The whole journey, audit counts, and two computers
```

**Structure Decision**: One new feature, matching the backend's module. Check-in's call lives in `features/queue` with every other queue operation, and the appointment's page uses it through `public.ts`. Doctor and patient choosers are reused through `public.ts`, as booking does. `isOutcomeUnknown` and `allMessages` move to `lib/api` now they have a second real consumer.

## Decisions to Record

**[ADR 0013](../../docs/decisions/0013-live-reads.md)**, accepted by the owner: how live reads work, with TanStack Query only on the queue's pages, no server read, and what stops polling. It narrows part of ADR 0005, whose "normal" kind stays unbuilt, and it's what ADR 0011 left to this phase.

## Documents to Update

| File | Change |
|---|---|
| `docs/tech-stack.md` | `@tanstack/react-query` moves from Planned to in use, with its version |
| `docs/architecture.md` | "Reading in a Client Component" becomes real; add the queue feature |
| `docs/decisions/README.md`, `0005`, `0011` | ADR 0013 listed, with links from the two it builds on |
| `docs/backend-integration.md` | What the live suite confirms about queues. **New gap G8**: past days' entries can't be reached, so anything open at midnight stays so |
| `docs/frontend-blueprint.md` | Queue pages as built, including `/queue/walk-in`. **Check-in sits on the appointment's page**, not `/queue`. Status line |
| `docs/development-guidelines.md` | How to write a live list, and that a confirmation must sit above anything a refresh can remove |
| `docs/roadmap.md` | Phase status |
| `specs/006-appointments/spec.md` | Notes on FR-023 and FR-024, pointing to this spec's FR-001 and FR-029a |

## Risks

| Risk | Mitigation |
|---|---|
| Polling continues on a page Next.js keeps hidden, keeping sessions alive and reading patient details nobody is viewing | Measured first, before anything depends on it (R2), with a stated fallback, and kept as a permanent test |
| A later screen polls something audited | The `live` policy lives in one module and ADR 0013 names its limits. Its description lists what must never use it |
| A refresh removes a row while someone is confirming it | The dialog sits above the rows and holds its own copy of what it's about (R5), with a test |
| A browser reporting itself offline quietly pauses reads, hiding the out-of-date notice | `networkMode: "always"`, so failures surface (R3), with a test |
| Polling on many computers loads the API | One read per visible list per 15 seconds. The backend measured a page of 100 at under 20 ms with 5,000 entries |
| A visible screen keeps a session alive indefinitely | H3, accepted by the owner in decision Q2 |
| Doctors find a confirmation on every call slow | The owner's decision, in the clarifications. The dialog opens on the safe choice, so Enter alone can't call someone by accident |
| People left open at midnight stay so, with no way to reach them | New gap G8. The application can't fix it, and doesn't pretend to |
| An undone number or a late arrival makes numbers look out of order | Numbers are labelled as numbers, and order is the API's |
| The clinic's clock in the frontend differs from the backend's | H4, an existing deployment concern. Only whether "Check in" is offered could differ, and the API decides |
| The live refresh test is slow | It waits for one real interval only. Everything else uses Playwright's clock on the fake backend |
| Live data accumulates | Runs use dated synthetic data, in the local Docker database only |

## Complexity Tracking

No exceptions to the constitution.
