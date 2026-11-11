# Implementation Plan: Role Dashboards

**Branch**: `012-role-dashboards` | **Date**: 2026-11-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/012-role-dashboards/spec.md`

## Summary

Replace the welcome-only `/dashboard` with a dashboard for each role, composed of panels that each read one or more existing, unaudited
lists or reports. The receptionist's panels cover today's appointments, the queue by status, money owed, and appointments to move; the
doctor's cover the patient with them, who is waiting, later appointments, and records to finish; the administrator's cover today's money,
activity, and appointments to move.

**The main design point is independent panels with honest counts.** Each panel is one `useLiveList` query whose read makes its requests
together, so a panel fails, refreshes, and shows "last read" as one, and never affects another (R1, R3). Every figure is a list's
`meta.total` read with `per_page=1`, a report's total, or the length of a list the API returns whole; nothing reads a second page (R2).

**The second is reading as the owner decided:** live every 15 seconds while visible for the desk and doctors, on demand for administrators,
with no new policy ([ADR 0019](../../docs/decisions/0019-dashboards-read-in-panels.md), accepted). No audited endpoint is ever requested.

## Technical Context

**Language/Version**: TypeScript 5.9.3, Node 24, React 19.3.1, Next.js 16.4.5 with Cache Components

**Primary Dependencies**: None new. TanStack Query 5.106.1 (already used for live lists), Zod 4.6.7, next-intl 4.14.9

**Storage**: None. In-memory query cache under `["dashboard"]`, cleared by sign-out's and `401`'s full page load

**Testing**: Vitest and Testing Library; Playwright with axe against the production build and the fake backend, which already supports
every filter used; `pnpm test:e2e:live` against the Docker API, with figure-equality and zero-audit checks

**Target Platform**: Modern browsers on desktop and tablet, Chromium tested

**Project Type**: Web application, frontend with BFF

**Performance Goals**: The receptionist reads the three key figures within 5 seconds of opening (SC-001). Per open, and per 15 seconds while
visible for live dashboards: 12 small reads (receptionist), 4 (doctor), 3 on demand (administrator) (R2)

**Constraints**: No audited read; no second page; money as strings; clinic dates as sent and instants in the clinic's time zone; today
computed when each read runs; logical CSS; WCAG 2.2 AA in both directions and themes

**Scale/Scope**: 1 page changed (`/dashboard`), 1 new feature (`dashboard`) with 1 read module, 3 dashboards, 11 panels, 1 shared panel frame
inside the feature, 1 new `public.ts` (appointments), about 60 message keys per locale

## Constitution Check

*GATE: Passed before research. Re-checked after design, with the same result.*

| Principle | Status | How |
|---|---|---|
| I. Backend is source of truth | Pass | Every endpoint, filter, limit, and field checked in contracts `006`–`010` at `dff2dca` (research, Facts). Counts are the API's totals; nothing re-derived |
| II. Security and privacy | Pass | Only unaudited reads, listed in [api-usage](contracts/api-usage.md), with a test that the module requests nothing else. No row links to a patient or record. Query cache in memory only. No phone kept for listed rows |
| III. Role-based UI is UX | Pass | Dashboard chosen by role, each panel inside `<Can>` with its capability from the one map; every panel handles `401`, `403`, `404` itself. `ScreenGate` unchanged |
| IV. Feature-based architecture | Pass | New `features/dashboard` with its own API module; other features only through `public.ts` (appointments gains one for `UPCOMING_DAYS`) |
| V. Strict typing | Pass | Narrow schemas `satisfies z.ZodType<Pick<Generated, …>>`; money as strings; no `any` |
| VI. Every state designed | Pass | [screens](contracts/screens.md): loading, shown, empty, out of date, failed, forbidden, not found per panel. No mutations |
| VII. Bilingual, accessible | Pass | `dashboard.*` in both files; figures as text with labels; sections labelled; axe on each state |
| VIII. Tested before done | Pass | [quickstart](quickstart.md): every role, both locales, live equality and zero-audit checks |
| IX. Simplicity | Pass | No dependency, no policy, no shared component; the panel frame stays in the feature until a second consumer exists |
| X. Spec-driven | Pass | Full cycle; four clarifications. ADR 0019 accepted by the owner on 2026-11-11 (T029) |

## Order of Work

1. **Foundations**: `features/appointments/public.ts` (`UPCOMING_DAYS`), dashboard types and narrow schemas, `api/dashboard.ts` with one
   read per panel and its query tests (filters, `per_page`, today, the never-requested list), the failure-priority helper, messages.
2. **Panel frame**: `DashboardPanel` with heading, link, figures, short list, `LastRead`, and every state, with its tests.
3. **Page and role switch**: `/dashboard` keeps the welcome and adds `LiveQueryProvider` and the role's dashboard, inside `ScreenGate`.
4. **US1 receptionist** panels; **US2 doctor** panels; **US3 administrator** panels, each with unit tests, then the e2e journeys.
5. **US4**: panel isolation in e2e (failure, refusal, not found, Try again), live and on-demand reading measured.
6. **Live suite** (`e2e/live/dashboard.spec.ts`), accessibility states, documents.

## Project Structure

### Documentation (this feature)

```text
specs/012-role-dashboards/
├── spec.md
├── plan.md                  # This file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api-usage.md
│   └── screens.md
├── checklists/requirements.md
└── tasks.md                 # Next step: /speckit-tasks
```

### Source Code

```text
src/
├── app/[locale]/(app)/dashboard/page.tsx      # Welcome, provider, the role's dashboard
├── features/dashboard/
│   ├── api/dashboard.ts                       # One read per panel; per_page 1 or 5; today when read
│   ├── api/dashboard.test.ts
│   ├── schemas/dashboard.ts                   # Narrow schemas against generated types
│   ├── first-refusal.ts                       # 401 > 403 > 404 > other, for a panel's several requests
│   ├── query-keys.ts                          # DASHBOARD_ROOT_KEY = ["dashboard"]
│   ├── links.ts                               # Each panel's and figure's address (research R7)
│   ├── types.ts
│   └── components/
│       ├── dashboard-panel.tsx                # Frame and every state
│       ├── figure-list.tsx                    # Labelled counts, optionally linked
│       ├── receptionist-dashboard.tsx         # Four panels
│       ├── doctor-dashboard.tsx               # Four panels from three reads
│       ├── administrator-dashboard.tsx        # Three panels, on demand
│       ├── needing-a-move-panel.tsx           # Shared by receptionist and administrator
│       └── *.test.tsx
├── features/appointments/public.ts            # New: UPCOMING_DAYS
└── messages/{en,ar}.json                      # dashboard.*

e2e/
├── dashboard.spec.ts
├── accessibility.spec.ts                      # Gains the dashboards' states
└── live/dashboard.spec.ts
```

**Structure Decision**: One new feature, `dashboard`, matching the route rather than a backend module, as it composes several. It reads
through its own module so no other feature changes beyond one `public.ts` export.

## Decisions to Record

- **[ADR 0019](../../docs/decisions/0019-dashboards-read-in-panels.md)**, accepted: dashboards read in the browser, one query per panel,
  live for the desk and doctors, on demand for administrators; `LiveQueryProvider` on a fourth page. Implementation proceeds on the
  proposal; T029 records the owner's acceptance when given.

## Documents to Update

| File | Change |
|---|---|
| `docs/architecture.md` | Dashboards under "A list that stays current"; the fourth provider page |
| `docs/decisions/README.md` | ADR 0019 listed; 0013, 0015, 0016 link forward |
| `docs/frontend-blueprint.md` | Dashboards table as built, with the final panels and sources |
| `docs/backend-integration.md` | What the live suite confirms: no entries from dashboards; totals matching screens |
| `docs/roadmap.md` | Phase status |

## Risks

| Risk | Mitigation |
|---|---|
| An audited read slips in | The never-requested test on the API module, and an e2e listener failing on any audited path while a dashboard is open; live zero-audit count |
| A figure disagrees with its linked screen | Same filters and defaults; `UPCOMING_DAYS` imported; My visits linked with explicit dates; live equality test per figure |
| Request load from open receptionist dashboards | 12 one-row reads per 15 s per visible desk, none while hidden; no backend rate limit. Revisit in Phase 13's performance review |
| Yesterday's figures after midnight | Today computed in each read and part of the key; unit test with a test clock |
| A panel half-updated | One query per panel, failing as one |
| A role change mid-session | Each panel's `403` clears it; the page changes role on reload, as the spec says |

## Complexity Tracking

No exceptions.
