# Implementation Plan: Hardening and Production Readiness

**Branch**: `013-hardening` | **Date**: 2026-11-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/013-hardening/spec.md`

## Summary

Make the finished application safe and ready to run in production, adding one new behavior: an inactivity lock on medical-record pages.

**The main design point is a lock that hides everything and loses nothing.** After 5 minutes without activity, a native modal dialog
covers the whole window, which makes the rest of the document inert, while the page underneath stays mounted with its unsaved text, open
dialogs, and requests in flight (R4). Only the same person's password opens it, through a new `POST /api/auth/unlock` that signs in with the
email and id sealed in the cookie at sign-in, never with anything the browser sends, then ends the old token and seals the new one (R3).

**The second is a content security policy that fits how pages are built.** Measured on the production build: every page streams inline
scripts written at request time, and the prerendered shell holds inline scripts too, so neither a hash nor a nonce can allow them without
giving up prerendering. The owner chose to allow inline scripts and keep every other directive strict: scripts only from this site, and no
connections, images, fonts, forms, framing, or plugins to or from anywhere else (R1, [ADR 0021](../../docs/decisions/0021-security-headers.md)).

**Around those**: the client's address passed on to the backend, ready for its trusted-proxy change (H2, R5); a standalone Docker image,
a health check, and an example Caddy proxy beside the backend's Compose (R6, R7, [ADR 0022](../../docs/decisions/0022-deployment.md)); a
permanent live journey suite across all three roles in both locales (R8); an accessibility sweep of every route (R9); speed measured with
the browser's own timings (R10); the unused placeholder removed and `CursorPager` moved into audit (R11); and a recorded security review
(R12).

## Technical Context

**Language/Version**: TypeScript 5.9.3, Node 24, React 19.3.1, Next.js 16.4.5 with Cache Components

**Primary Dependencies**: None new in `package.json`. iron-session 9.0.1 (seal gains two fields), Zod 4.6.7, next-intl 4.14.9. Deployment
only, outside `package.json`: the `node:24-alpine` image and the Caddy 2 image, both pinned by exact version and recorded in
`docs/tech-stack.md`

**Storage**: The sealed cookie gains `userId` and `email` ([data-model](data-model.md#sealed-session)). Nothing in browser storage

**Testing**: Vitest and Testing Library (lock timing with fake timers, unlock route, headers); Playwright on the production build with the
fake backend, using `page.clock` to pass 5 minutes, and axe across every route in both locales and themes; `pnpm test:e2e:live` for journeys,
unlock audit entries, server output, and speed; `docker build` and the `deploy/` example for deployment

**Target Platform**: Modern browsers on clinic desktops and tablets, Chromium tested; a Linux Docker host beside the backend

**Project Type**: Web application, frontend with BFF

**Performance Goals**: Each role's main screens show content within 2.5 s and respond to a press within 200 ms, at the 75th percentile, on
a production build against the local API (SC-007). Unlocking under 10 s for the person (SC-002)

**Constraints**: No setting baked into the image; no new runtime dependency; prerendering kept (ADR 0006); no request from a locked page;
no audited read on unlock; tokens and the password never in a response or log; logical CSS; WCAG 2.2 AA

**Scale/Scope**: 1 new client component and 1 new route (lock and unlock), 1 new route (health), sign-in and session changed, 1 header
module, 1 lint rule, `callBackend` changed, 2 pages wrapped, 1 component removed and 1 moved, `Dockerfile`, `.dockerignore`, 3 files in
`deploy/`, `docs/deployment.md`, 3 new e2e specs, about 12 message keys per locale

## Constitution Check

*GATE: Passed before research. Re-checked after design, with the same result.*

| Principle | Status | How |
|---|---|---|
| I. Backend is source of truth | Pass | Sign-in, sign-out, and audit actions checked in contracts at `dff2dca`; the absence of trusted proxies checked in the backend source (research, F7–F11). Backend changes are written requests only (B1–B3) |
| II. Security and privacy | Pass | Lock covers record pages; password only in the field and one request body; email and id sealed, never sent to the browser; old token ended. Headers on every response; caches already private. Server output checked for patient data and query strings. Unlock reads no record (no audited read) |
| III. Role-based UI is UX | Pass | The lock is on doctor-only pages already behind `ScreenGate`; unlock's `403` and `409` handled; the backend decides who may sign in |
| IV. Feature-based architecture | Pass | Lock and unlock in `features/auth`, used by `features/encounters` through `public.ts`. `CursorPager` moves into its only consumer. Headers in `lib/security`, used by config and tests |
| V. Strict typing | Pass | Seal type extended; unlock body parsed with Zod; no `any`, no casts |
| VI. Every state designed | Pass | [inactivity-lock](contracts/inactivity-lock.md): locked, unlocking, refused, cannot unlock, confirming sign-out, signing out. Sign-out from the lock is irreversible for unsaved text, so it asks and says so |
| VII. Bilingual, accessible | Pass | `auth.lock.*` in both files; native modal dialog for focus and inertness; axe on the locked state; a full sweep of every route in both directions and themes; by-hand checks recorded |
| VIII. Tested before done | Pass | [quickstart](quickstart.md); live journeys in both locales; results recorded as observed |
| IX. Simplicity | Pass | No dependency; no new setting; the lock's limit is a constant; speed measured with browser APIs, not a library; the placeholder removed |
| X. Spec-driven | Pass | Full cycle; ten clarifications, one made during planning (R1). ADRs 0020–0022 proposed for the owner |

ADR 0007 said a strict policy "must allow the theme script by hash or nonce". R1 shows that can't be done without giving up ADR 0006, and
the owner chose otherwise. ADR 0021 records this and amends ADR 0007's expectation; it's a decision, not a constitution exception.

## Project Structure

### Documentation (this feature)

```text
specs/013-hardening/
├── plan.md              # This file
├── research.md          # R1–R13 and facts F1–F19
├── data-model.md        # Seal, lock states, review record, pre-production items
├── quickstart.md        # Validation, automated and by hand
├── contracts/
│   ├── unlock-route.md
│   ├── inactivity-lock.md
│   ├── security-headers.md
│   └── deployment.md
├── checklists/requirements.md
├── review.md            # Created during implementation: security, accessibility, speed findings
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
Dockerfile, .dockerignore                      # new (R6)
deploy/compose.yaml, Caddyfile, frontend.env.example   # new (R6)
next.config.ts                                 # output: "standalone", headers() (R1, R2, R6)
playwright.config.ts, playwright.live.config.ts   # run the standalone server, as the image does (R6)
eslint.config.mjs                              # react/no-danger as an error (R1)
src/lib/security/headers.ts                    # new: the header set, one constant
src/lib/auth/session.ts                        # seal gains userId and email; saveSession(token, user)
src/lib/api/server-api.ts                      # forwards X-Forwarded-For (R5)
src/app/api/auth/sign-in/route.ts              # seals the user's id and email
src/app/api/auth/unlock/route.ts               # new (contracts/unlock-route.md)
src/app/api/health/route.ts                    # new (R7)
src/features/auth/api/unlock.ts                # new: browser call to the unlock route
src/features/auth/components/inactivity-lock.tsx   # new (contracts/inactivity-lock.md)
src/features/auth/public.ts                    # exports InactivityLock
src/app/[locale]/(app)/my/encounters/[id]/page.tsx        # wraps EncounterRecord
src/app/[locale]/(app)/my/patients/[id]/history/page.tsx  # wraps PatientHistory
src/features/app-shell/components/placeholder.tsx         # removed (R11)
src/app/[locale]/(app)/[...section]/page.tsx              # not-found only
src/lib/auth/app-routes.ts                     # `built` removed
src/components/shared/cursor-pager.tsx  →  src/features/audit/components/cursor-pager.tsx
src/messages/{ar,en}.json                      # auth.lock.*, placeholder keys removed
e2e/inactivity-lock.spec.ts                    # new, fake backend
e2e/security-headers.spec.ts                   # new, fake backend
e2e/accessibility.spec.ts                      # extended to every route (R9)
e2e/token-absence.spec.ts                      # extended to unlock (R12)
e2e/live/journeys.spec.ts                      # new (R8)
e2e/live/lock.spec.ts                          # new: unlock's audit entries on the real API
e2e/live/performance.spec.ts                   # new (R10)
e2e/support/fake-backend.mjs                   # sign-in for unlock cases, if not already enough
docs/deployment.md                             # new: the guide and the pre-production list
```

**Structure Decision**: The existing single Next.js project. The lock is authentication's concern (password, session, sign-out), so it
lives in `features/auth` and is used by the encounters pages through `public.ts`. Deployment files sit at the root and in `deploy/`.

## Order of Work

1. **Spike** (R4, R6): a native modal dialog over an open Radix alert dialog, for focus; `next build` with standalone on Windows, and both test suites moved to the standalone server. Either
   failing changes the design before anything is built on it.
2. **Headers** (US2): constant, `next.config.ts`, lint rule, header and policy tests. Early, as every later end-to-end test then runs with
   the policy in force.
3. **Session and unlock** (US1): seal fields, sign-in change, unlock route with unit tests, browser call.
4. **Lock** (US1): component, two pages, messages, component and end-to-end tests, live audit test.
5. **Client address** (US5, R5) and **health** (R7).
6. **Clean-up** (US7).
7. **Image and example proxy** (US5), then the deployment guide and the pre-production list.
8. **Journeys, accessibility sweep, speed** (US3, US4, US6).
9. **Security review** and fixes (US2), `review.md`.
10. **Documents**: architecture (lock, headers, deployment), backend-integration (H2 forwarding done on this side; B1–B3), tech-stack
    (images), roadmap, ADR statuses.

## Decisions to record

| ADR | Decision | Status |
|---|---|---|
| [0020](../../docs/decisions/0020-inactivity-lock.md) | Medical-record pages lock after 5 minutes; a native modal keeps the page mounted; unlock is a fresh sign-in with the sealed email and id | Proposed |
| [0021](../../docs/decisions/0021-security-headers.md) | A static policy allowing inline scripts, strict otherwise; the app sets headers, the proxy sets HSTS. Amends ADR 0007's expectation | Proposed |
| [0022](../../docs/decisions/0022-deployment.md) | Standalone Docker image behind Caddy on the backend's network; the client's address forwarded; a frontend-only health check | Proposed |

## Complexity Tracking

No constitution violations to justify.
