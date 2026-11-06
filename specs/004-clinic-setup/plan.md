# Implementation Plan: Clinic Setup

**Branch**: `004-clinic-setup` | **Date**: 2026-11-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-clinic-setup/spec.md`

## Summary

Build the screens that take a doctor from a new account to bookable with a fee: staff accounts, the specialty catalog, doctor profiles, weekly schedules, time off, fees, a read-only view for reception, and the doctor's own "My schedule".

Pages read on the server, forms change data through the existing same-origin route, and `router.refresh()` updates what's on screen. A production-build spike against the real backend showed that this also updates pages opened before the change, so **TanStack Query still isn't needed**. See [research.md](research.md), R1.

Reading the backend's source, beyond its contracts, shaped three parts of the design:

- Schedule errors come under two kinds of key, `periods.N` and `periods.N.start`. The schedule form sends rows in the order they appear on screen, so an index always leads back to its row (R5).
- An administrator's own password reset ends their own session, so it's replaced by a link to the account page, as the owner decided.
- The account-to-profile step is a separate choice of account, followed by the form. That avoids needing a large picker, and works around gaps G1 and G2 (R4).

## Technical Context

**Language/Version**: TypeScript 5.9.3, Node 24, React 19.3, Next.js 16.4.5 with Cache Components

**Primary Dependencies**: None added. `react-hook-form`, `zod`, and `radix-ui` are already installed. `@tanstack/react-query` stays uninstalled (R1)

**Storage**: None new. No browser storage

**Testing**: Vitest and Testing Library; Playwright with axe against the production build and the fake backend, which gains clinic data; `pnpm test:e2e:live` against the Docker API for the full journey

**Target Platform**: Modern browsers on desktop and tablet, Chromium tested, as in earlier phases

**Project Type**: Web application, frontend with BFF

**Performance Goals**: A doctor's page makes at most six API calls per load: identity, profile, schedule, slots, time off, fee. No call comes from prefetching

**Constraints**: No audited reads in this phase. Money stays a string. Clinic dates and times are never passed through `Date` in the browser's zone. `24:00` must survive entry and display. Never compare message text. WCAG 2.2 AA in both directions

**Scale/Scope**: 11 pages, 4 features, about 30 API operations, up to 100 rows a page

## Constitution Check

*GATE: Passed before research. Re-checked after design, with the same result.*

| Principle | Status | How |
|---|---|---|
| I. Backend is source of truth | Pass | All operations checked in contracts `staff-auth`, `doctors`, `scheduling`, `payments`, and form rules checked in backend source. Bookability comes only from the API's slots. Client checks are for speed, and the API's answer wins |
| II. Security and privacy | Pass | No patient data and no audited reads in any screen; confirmed against the audit list. Passwords use POST forms, and are cleared after use. No browser storage. Filters in addresses hold staff and doctor data only, never patient details |
| III. Role-based UI is UX | Pass | One role map; gates on the server; `Can` hides controls; `401`, `403`, `404` handled on every read and action |
| IV. Feature-based architecture | Pass | `features/staff`, `doctors`, `scheduling`, `fees`, each with `api/`. The doctor page composes them from `app/`, so features don't import each other |
| V. Strict typing | Pass | Types from generated contracts. Response schemas use `satisfies z.ZodType<Generated>`, as `features/auth` does. Fee kept as a string, including the range check |
| VI. Every state designed | Pass | Loading, error, empty, and success on each list and section. Mutations show progress, block double submission, map errors, and confirm. See [contracts/screens.md](contracts/screens.md) |
| VII. Bilingual, accessible | Pass | All text in both files. Days and roles translated; names as stored. Times and amounts stay left-to-right. Axe on every new screen |
| VIII. Tested before done | Pass | See [quickstart.md](quickstart.md). Results recorded in `tasks.md` |
| IX. Simplicity | Pass | No dependency added. No client cache. No wizard. No generic form builder. `RetryButton`, `SessionEndRedirect` already public and reused |
| X. Spec-driven | Pass | Full cycle. One new ADR below |

## Order of Work

1. **Foundations.** `ScreenGate`'s `capability` prop, `ApiFailureState`, clinic-today and date helpers, digit normalising, and a stateful fake backend. Later steps all depend on these.
2. **Specialties.** The simplest screen, and doctors need it. It sets the pattern for lists and forms.
3. **Staff.** List, create, view, edit, deactivate, reactivate, set password, and the self-action rules.
4. **Doctors.** List, choose an account, create, edit, and the doctor's page frame with the profile section.
5. **Weekly schedule.** Read-only view, then the editor.
6. **Fees.** The doctor's page section, then the list.
7. **Readiness and slots.** Now that all inputs exist. This finishes the main journey.
8. **Time off.** View, add, remove.
9. **Reception's read-only behaviour,** checked per role across all of the above.
10. **My schedule,** reusing the read-only views.
11. **Live journey, accessibility, documents.**

## Project Structure

### Documentation (this feature)

```text
specs/004-clinic-setup/
├── spec.md
├── plan.md                  # This file
├── research.md              # Spike evidence and decisions
├── data-model.md            # Entities, form shapes, readiness rules
├── quickstart.md            # How to validate
├── contracts/
│   ├── api-usage.md         # Each screen's API operations and error keys
│   └── screens.md           # Each screen's roles, address, and states
└── tasks.md                 # Next step: /speckit-tasks
```

### Source Code

```text
src/
├── app/[locale]/(app)/
│   ├── staff/{page,new/page,[id]/page}.tsx
│   ├── specialties/page.tsx
│   ├── doctors/{page,new/page,[id]/page,[id]/edit/page,[id]/schedule/page}.tsx
│   ├── fees/page.tsx
│   └── my/schedule/page.tsx
├── features/
│   ├── staff/                     # List, forms, account actions
│   ├── doctors/                   # Profiles and specialties; readiness.ts takes plain inputs
│   ├── scheduling/                # Schedule view and editor, slots, time off; shared with My schedule
│   ├── fees/                      # Fee section and list
│   ├── auth/
│   │   ├── components/screen-gate.tsx        # Gains `capability`
│   │   └── components/api-failure-state.tsx  # 401, 403, 404, or an error with retry
│   └── app-shell/                 # `Can`, unchanged
├── lib/
│   ├── auth/app-routes.ts         # `built: true` on five rows
│   └── format/
│       ├── clinic-today.ts        # Today in the clinic's zone, and adding days to a clinic date
│       └── digits.ts              # Arabic-Indic digits to Western, for fee and time fields
└── messages/{en,ar}.json          # staff.*, specialties.*, doctors.*, scheduling.*, fees.*, days.*

e2e/
├── staff.spec.ts, specialties.spec.ts, doctors.spec.ts, schedule.spec.ts, time-off.spec.ts, fees.spec.ts, clinic-roles.spec.ts, my-schedule.spec.ts
├── accessibility.spec.ts          # Gains the new screens
├── support/fake-backend.mjs       # Gains stateful clinic data, and routes with ids
└── live/clinic-setup.spec.ts      # The whole journey, and session ending by an administrator
```

**Structure Decision**: Four features, matching the backend's modules. Specialties live in `features/doctors`, because the backend's Doctors module owns them and only the doctor form consumes them. `readiness.ts` takes plain values, so `features/doctors` needn't import `scheduling` or `fees`. The page in `app/` fetches from each, and passes the results in.

## Decisions to Record

| Document | Content |
|---|---|
| ADR 0011, server reads and refresh | Pages read on the server, mutations go through the same-origin route, and `router.refresh()` updates the screen. TanStack Query waits for the queue's polling in Phase 7. Includes the spike's evidence and the condition for revisiting |

## Documents to Update

| File | Change |
|---|---|
| `docs/architecture.md` | "Reading and writing in a Client Component" describes TanStack Query, which isn't what's built: add the read-then-refresh flow. Add the new features |
| `docs/tech-stack.md` | TanStack Query's "First client query" row becomes "Phase 7 polling, see ADR 0011" |
| `docs/backend-integration.md` | Form behaviour found in source: `periods.N` and `periods.N.start` keys, an empty period list being valid, own-account actions. G2's current approach becomes the chosen-account step |
| `docs/frontend-blueprint.md` | Add the sub-pages; status line; `Can` now has consumers |
| `docs/decisions/README.md` | ADR 0011 |
| `docs/roadmap.md` | Phase status; My schedule belongs to this phase |
| `docs/development-guidelines.md` | Mutate, then `router.refresh()`; `ScreenGate`'s `capability`; `ApiFailureState` |
| `specs/003-auth-app-shell/contracts/app-shell.md` | `ScreenGate`'s new prop |

## Risks

| Risk | Mitigation |
|---|---|
| `router.refresh()` stops reaching hidden routes in a later Next.js version | `e2e/clinic-roles.spec.ts` keeps the spike's scenario as a permanent test: open a list, change data elsewhere, return by link and by the back button |
| Hidden routes keep old pages in the DOM, so a test or a locator can find two copies | Learned in the spike. Tests use role queries, which skip hidden content |
| An administrator's own deactivation may show a flash of error before the redirect | `browserApi` never settles on `401`, and refresh goes through the gate's `SessionEndRedirect`. Covered by a live test |
| Live test data accumulates, as nothing can be deleted | Runs use dated synthetic names and the existing teardown deactivates accounts. Specialties stay, deactivated |
| A schedule screen has many fields on a narrow tablet | Rows stack per day, and the screen is checked at tablet width in both directions |
| Two administrators editing at once | The API has no conflict detection, so the last save wins. The spec accepts this |
| Sign-in and audit addresses stay wrong until the backend change | Existing production blocker H2, unchanged |

## Complexity Tracking

No violations.
