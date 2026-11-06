# Implementation Plan: Authentication and App Shell

**Branch**: `003-auth-app-shell` | **Date**: 2026-11-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-auth-app-shell/spec.md`

## Summary

Put a sealed-cookie BFF between the browser and Laravel, and build the signed-in application around it: sign-in, sign-out, session end, a
same-origin route to the API, one role map, role navigation, guarded pages, not-allowed and not-found states, doctor-without-profile, and
change password.

A production-build spike against the real backend settled the design, and overturned parts of what was assumed. See
[research.md](research.md). The main results:

- A default link's prefetch **does** run cookie-based reads on the server, which corrects ADR 0006. Every server read of the API now waits
  for a real request, so no link can trigger one.
- Paginated responses hold Laravel's private address, so the same-origin route removes those fields. The spec's FR-006 was amended.
- Checks belong in pages rather than the layout, and a Server Component can't clear a cookie, so the session ends through one route handler.

## Technical Context

**Language/Version**: TypeScript 5.9.3, Node 24, React 19.3, Next.js 16.4.5 with Cache Components and partial prefetching

**Primary Dependencies**: Added: `iron-session` 9.0.1, `react-hook-form` 7.91.0, `@hookform/resolvers` 7.0.3. All pinned exact. `@tanstack/react-query` and `msw` are **not** added: nothing in this phase needs them (research R10)

**Storage**: One sealed, HttpOnly session cookie, which lasts until the browser closes. No other new browser storage

**Testing**: Vitest and Testing Library; Playwright with axe against the production build and the fake backend, extended for auth; `pnpm test:e2e:live` against the Docker API

**Target Platform**: Modern browsers on desktop and tablet, as in Phase 2. Chromium is the only browser tested, until Phase 13

**Project Type**: Web application, frontend with BFF

**Performance Goals**: One identity call per page load or navigation, and none from prefetching (measured in the spike, and kept as a test)

**Constraints**: No token in any browser-reachable place; no `use cache` or `use cache: private` on session data; never re-create the request in `src/proxy.ts`; no audited reads in this phase; the build needs no runtime configuration; WCAG 2.2 AA; both directions

**Scale/Scope**: 6 BFF and server modules, about 15 components, 2 forms, 15 placeholder destinations from one route table

## Constitution Check

*GATE: Passed before research. Re-checked after design, with the same result.*

| Principle | Status | How |
|---|---|---|
| I. Backend is source of truth | Pass | Endpoints checked in contracts `staff-auth` and `doctors`. Response shapes and refusals observed live (research R1, R2). No message-text matching. Role map transcribed from the verified matrix |
| II. Security and privacy | Pass | Token sealed server-side and proven absent by test. Sealed value refused by the API (observed). No audited reads. Return addresses drop queries and skip audited pages. Full navigation clears memory at session end. Logging of incoming requests turned off |
| III. Role-based UI is UX | Pass | One map. Pages check on the server per navigation. `403` wins over the map. No patient portal |
| IV. Feature-based architecture | Pass | `features/auth`, `features/app-shell`. Network calls only in API modules. Server-only modules guarded |
| V. Strict typing | Pass | Types from generated `staff-auth` and `doctors`. `unknown` plus narrowing at the BFF boundary. No money in this phase |
| VI. Every state designed | Pass | Loading, error, success on each screen, with no empty state applicable. Forms show progress, block double submission, map errors, and confirm |
| VII. Bilingual, accessible | Pass | All text in both message files. Identical checks in both directions. Axe on every new screen |
| VIII. Tested before done | Pass | See [quickstart.md](quickstart.md). Results recorded in `tasks.md` |
| IX. Simplicity | **Exception** | `Can` is built before its first consumer: see Complexity Tracking. Otherwise met: one route table in place of 15 placeholder files, and TanStack Query and `msw` not installed |
| X. Spec-driven | Pass | Full cycle. FR-006 amended from live evidence, and flagged to the owner. Decisions below |

## Order of Work

1. **Configuration and API foundation.** `SESSION_SECRET`, `ApiError`, the server API module, and the page-link stripping.
2. **Sessions and BFF routes.** Sign-in, sign-out, session-ended, and the same-origin route, each with origin and path checks. These are the security core, so they're tested first.
3. **Role map and route table,** with the comparison against the documented matrix.
4. **Layout move and proxy.** The header leaves the root layout, the status check moves to sign-in, and the proxy learns sessions. Existing end-to-end tests are updated here, as the behaviour changes.
5. **Sign-in page.**
6. **Shell, gate, states, placeholders, landing page.**
7. **Session end in the client:** one-redirect guard, other tabs, back-button restore.
8. **Doctor without a profile.**
9. **Account and change password.**
10. **Live tests, pagination record, and documents.**

## Project Structure

### Documentation (this feature)

```text
specs/003-auth-app-shell/
├── spec.md
├── plan.md                  # This file
├── research.md              # Spike evidence and decisions
├── data-model.md            # Session, role map, route table, return address
├── quickstart.md            # How to validate
├── contracts/
│   ├── bff-routes.md        # What the BFF routes accept and return
│   └── app-shell.md         # What later phases can rely on
└── tasks.md                 # Next step: /speckit-tasks
```

### Source Code

```text
src/
├── app/
│   ├── api/
│   │   ├── auth/{sign-in,sign-out,session-ended}/route.ts
│   │   └── backend/[...path]/route.ts       # Same-origin route to the API
│   └── [locale]/
│       ├── layout.tsx                       # Loses the header
│       ├── not-found.tsx                    # Gains the public header
│       ├── address-not-found/page.tsx       # Unknown address with no session; replaces [...rest]
│       ├── design-preview/page.tsx          # Gains the public header
│       ├── (auth)/
│       │   ├── layout.tsx                   # Public header
│       │   └── sign-in/page.tsx
│       └── (app)/
│           ├── layout.tsx                   # Static frame; Shell inside Suspense
│           ├── error.tsx, not-found.tsx     # Inside the frame
│           ├── dashboard/page.tsx
│           ├── account/page.tsx
│           └── [...section]/page.tsx        # Route table: placeholder, or not-found
├── proxy.ts                                 # Session redirect and unknown-address rewrite
├── components/shared/public-header.tsx      # Moved out of the root layout
├── features/
│   ├── auth/
│   │   ├── api/                             # sign-in, sign-out, change-password; current user; doctor profile
│   │   ├── components/                      # sign-in form, password form, screen gate, session watcher, no-profile state
│   │   ├── schemas/
│   │   └── types.ts
│   ├── app-shell/components/                # Shell, top bar, navigation, placeholder, Can
│   └── system-status/                       # Unchanged, now shown on sign-in
├── lib/
│   ├── api/
│   │   ├── api-error.ts                     # Status, message, field errors, reason
│   │   ├── server-api.ts                    # server-only; waits for a request; adds token and language
│   │   ├── browser-api.ts                   # Same-origin calls; any 401 ends the session
│   │   ├── map-field-errors.ts              # Onto React Hook Form
│   │   ├── strip-page-links.ts
│   │   └── pagination.ts                    # Confirmed meta type
│   ├── auth/
│   │   ├── session.ts                       # server-only; seal, read, destroy
│   │   ├── permissions.ts                   # The role map
│   │   ├── app-routes.ts                    # Route table; safe in the proxy and in client code
│   │   ├── return-address.ts                # Validation and audited pages
│   │   ├── session-end.ts                   # The one session end, and the channel between tabs
│   │   └── origin-check.ts
│   └── config/env-schema.ts                 # Adds SESSION_SECRET
└── messages/{en,ar}.json                    # auth.*, shell.*, roles.*

e2e/
├── auth.spec.ts, navigation.spec.ts, session-end.spec.ts, token-absence.spec.ts, account.spec.ts, doctor-profile.spec.ts
├── support/fake-backend.mjs                 # Gains auth, doctor, and scripted statuses
└── live/
    ├── setup.ts                             # Creates synthetic accounts through the API
    └── auth.spec.ts                         # Roles, revocation, deactivation, sealed-cookie refusal
```

**Structure Decision**: Follows `docs/architecture.md`. `features/app-shell` is separate from `features/auth`, as navigation and identity change for different reasons. The shell uses `features/auth` through a deliberate public export. `app-routes.ts` and `permissions.ts` stay free of server-only imports, because the proxy and client code read them.

## Decisions to Record

| Document | Content |
|---|---|
| ADR 0010, session and guard design | Cookie that ends with the browser and has no seal expiry; all server reads wait for a request; checks in pages; session end through one route; page-link stripping; route table; `use cache: private` rejected |
| ADR 0006, correction | Rule 3's reasoning is wrong: prefetch shells do include cookie-based content. The `prefetch={false}` rule on audited links stays, and ADR 0010's rule is what makes it safe |
| ADR 0001, addition | The forwarded client address waits for the backend change (research R9) |

## Documents to Update

| File | Change |
|---|---|
| `docs/tech-stack.md` | Move the three packages to installed; keep `@tanstack/react-query` planned for its first consumer; settle `msw` as not needed yet; close the `@hookform/resolvers` item |
| `docs/backend-integration.md` | Confirmed `meta` fields and page-link hazard, checked date and commit; "not yet run" becomes "live checks done"; port note |
| `docs/architecture.md` | Remove "not built yet" for this phase; session flow, proxy rules, placement of checks, header move |
| `docs/frontend-blueprint.md` | `Can` is built; landing and status change |
| `docs/development-guidelines.md` | Pages wrap all content in the gate; server reads go through `server-api`; `prefetch` note |
| `docs/roadmap.md` | Phase status |
| `CLAUDE.md`, `README.md`, `.env.example` | `SESSION_SECRET`; live test accounts; the port note, because the backend is on 8080 on this machine today, not 8081 |

## Risks

| Risk | Mitigation |
|---|---|
| Later code calls the API outside `server-api`, and a prefetch reaches it | The module is the only server network path in the guidelines; a fake-backend test proves no calls come from visible links; re-checked in Phase 5 for audited reads |
| Later pages place content outside the gate, where it enters the static shell | Contract in `app-shell.md`, and a test that the not-allowed response lacks page text. A review item for each later phase |
| Chromium's headless mode doesn't use the back-forward cache, so that restore path is hard to prove end to end | Pages are `no-store` (observed) and a `pageshow` handler reloads a restored page; the handler is unit-tested. Stated as a limit in `tasks.md` |
| The rewritten not-found page's language switch may show the internal address | `routing.spec.ts` already tests that it keeps the path. If it fails, the switch reads the address at click time |
| The shared sign-in limit (20 a minute) can be hit by live tests, since all go through one address | Live tests reuse stored sessions and sign in as few times as they can; the helper waits out a refusal |
| Sign-in and audit addresses stay wrong until the backend change | Existing production blocker H2, unchanged |

## Complexity Tracking

Approved by the project owner on 2026-11-06, with the phase.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principle IX ("Abstractions MUST wait for at least two real uses"): `Can` is built here, and no screen in this phase has an action that differs by role. Navigation filters through the route table instead | The roadmap and the owner's Phase 2 decision assign `Can` to this phase, with the role map, and FR-016 requires it. It's about ten lines over `can()`, and Phase 4's read-only views for receptionists are its first consumers | Building it in Phase 4 would follow the principle, but would contradict the accepted roadmap, and would leave the role map's one reusable control untested until then. If the owner prefers, it can move to Phase 4 with a roadmap edit |
