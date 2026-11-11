# Implementation Plan: Audit Log

**Branch**: `011-audit-log` | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/011-audit-log/spec.md`

## Summary

Build the administrator's audit log at `/audit`: filters, a search on Search only, entries newest first with every detail translated, and
Older and Newer through a new shared `CursorPager`.

**The main design point is that reading writes.** Each request writes a permanent `audit.searched` entry, so the search runs only inside the
handler of a person's press, once per press, with its state in memory only (R1, R2, ADR 0018). No effect reads, nothing is cached, and the
address never holds a query.

**The second is showing entries faithfully.** Identifiers are translated through maps checked against the generated enums, and anything
unknown is shown as sent. Kept values are described by record type and field, with money as strings (R5).

## Technical Context

**Language/Version**: TypeScript 5.9.3, Node 24, React 19.3.1, Next.js 16.4.5 with Cache Components

**Primary Dependencies**: None new. Zod 4.6.7, next-intl 4.14.9. No query library for this read (ADR 0018)

**Storage**: None. Component state only

**Testing**: Vitest and Testing Library; Playwright with axe against the production build and the fake backend, which gains
`/audit-entries` with cursors; `pnpm test:e2e:live` against the Docker API, with exact `audit.searched` counts (R10)

**Target Platform**: Modern browsers on desktop and tablet, Chromium tested

**Project Type**: Web application, frontend with BFF

**Performance Goals**: One request per press and none otherwise (SC-002). A charge's discount history found in under 30 seconds of work
(SC-001): type, number, Search

**Constraints**: No query string on the page's address. Instants in the clinic's time zone with seconds. Money as strings. Never match
message text. WCAG 2.2 AA in both directions and themes

**Scale/Scope**: 1 new page (`/audit`), 1 new feature (`audit`), 1 API operation plus 1 reused, 1 new shared component (`CursorPager`), small
additions to `FilterBar` (option groups), `formatInstant` (seconds), and `clinic-time` (minutes), about 110 message keys per locale

## Constitution Check

*GATE: Passed before research. Re-checked after design, with the same result.*

| Principle | Status | How |
|---|---|---|
| I. Backend is source of truth | Pass | Every filter, rule, field, value type, and subject id checked in the contract and source (research, Facts). Client checks are faster feedback; the API's `422` is still shown |
| II. Security and privacy | Pass | Reads only on a press (R1, R2). Nothing in the address, storage, or a cache. Patient numbers link only through `PatientLink`. Entries hold no patient details; no names are looked up. `403` clears |
| III. Role-based UI is UX | Pass | `audit` already maps to administrators only; `ScreenGate` on the page; the API's `403` handled regardless |
| IV. Feature-based architecture | Pass | New `features/audit`. `CursorPager` is shared as the blueprint plans, with one consumer, which Principle IX's "two uses" would delay; see Complexity Tracking. `PatientLink` through `patients/public` |
| V. Strict typing | Pass | Generated types; `satisfies` on every translation map and the action groups. `unknown` values read only by `describeValue` |
| VI. Every state designed | Pass | [contracts/screens.md](contracts/screens.md): before search, loading, moving, empty, out of date, field problems, position refused, error, move failed, forbidden. No mutations |
| VII. Bilingual, accessible | Pass | All text in both files; unknown identifiers shown as sent; values isolated; outcome by text. Axe on each state |
| VIII. Tested before done | Pass | [quickstart.md](quickstart.md), with every role, both locales, and live counts |
| IX. Simplicity | Pass, one exception | No dependency, no new policy. The exception is below |
| X. Spec-driven | Pass | Full cycle, three clarifications. ADR 0018 accepted with this plan |

## Order of Work

1. **Small shared additions**, each with its tests: `formatInstant` with seconds, `minutesToClockTime`, `FilterBar` option groups (existing
   screens unchanged), `CursorPager`.
2. **Foundations**: schemas and types, the API module, `readAuditFilters`, action groups, translation maps, `describeValue`, `readAllStaff`,
   messages, the fake backend's `/audit-entries`.
3. **The search hook**, `useAuditSearch`, with its one-read-per-press tests before any screen uses it.
4. **Page and access**: `/audit` with `ScreenGate`, `built: true`. Role access testable from here.
5. **US1 and US2**: filters, entries, states. **US3**: paging. **US4**: links.
6. **Live journey** (setup gains `auditAdmin`), accessibility, documents.

## Project Structure

### Documentation (this feature)

```text
specs/011-audit-log/
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
├── app/[locale]/(app)/audit/page.tsx        # Gate, staff list on the server, the search
├── features/audit/
│   ├── api/audit.ts                         # Browser: searchAuditEntries(filters, cursor, locale)
│   ├── components/
│   │   ├── audit-search.tsx                 # Filters, notice, results, pager
│   │   ├── audit-search.test.tsx
│   │   ├── audit-filters.tsx                # FilterBar definitions
│   │   ├── audit-entry.tsx                  # Summary and details
│   │   ├── entry-changes.tsx
│   │   ├── searched-filters.tsx
│   │   └── entry-link.tsx                   # Subject and actor links
│   ├── schemas/audit.ts
│   ├── action-groups.ts
│   ├── describe-value.ts
│   ├── labels.ts                            # Translations, falling back to the identifier as sent
│   ├── read-audit-filters.ts
│   ├── use-audit-search.ts
│   └── types.ts
├── features/staff/api/staff-server.ts       # Gains readAllStaff
├── components/shared/
│   ├── cursor-pager.tsx                     # New
│   └── filter-bar.tsx                       # Select options may carry a group
├── lib/
│   ├── format/instant.ts                    # Optional seconds
│   ├── format/clinic-time.ts                # minutesToClockTime
│   └── auth/app-routes.ts                   # `built: true` on audit
└── messages/{en,ar}.json                    # audit.*, shared.cursorPager.*

e2e/
├── audit.spec.ts
├── accessibility.spec.ts                    # Gains the audit page's states
├── support/fake-clinic.mjs                  # Gains /audit-entries
└── live/
    ├── setup.ts                             # Gains auditAdmin
    └── audit.spec.ts
```

**Structure Decision**: One new feature, `audit`, matching the backend's Audit module. The shared additions are small and land first, with
existing screens' tests unchanged.

## Decisions to Record

- **[ADR 0018](../../docs/decisions/0018-audit-search-on-press.md)**, accepted: the audit search reads only on a press, in memory, with no
  effect and no cache. Starts from ADR 0012. Accepted by the owner on 2026-11-10.

## Documents to Update

| File | Change |
|---|---|
| `docs/architecture.md` | The audit feature and ADR 0018 among audited reads; the query policy row |
| `docs/decisions/README.md` | ADR 0018 listed, status on acceptance; ADR 0012 links forward |
| `docs/backend-integration.md` | What the live suite confirms: one `audit.searched` per page, its `filters`, cursor stability, the cursor `422` |
| `docs/frontend-blueprint.md` | `/audit` as built; `CursorPager` no longer "still to come" |
| `docs/development-guidelines.md` | Audit search reads only in a press handler |
| `docs/roadmap.md` | Phase status |

## Risks

| Risk | Mitigation |
|---|---|
| A read from an effect, focus, or being shown again | No effect calls the API; unit tests for mount, Strict Mode, and re-render; live counts for focus, back, refresh, language |
| A double press writing two entries | The busy ref before the request, and disabled buttons; tested with two quick presses and Enter twice |
| Paging with filters changed in the form | Older and Newer use the filters shown; tested |
| A value shown wrongly, money most of all | `describeValue` with a row per case; money never parsed |
| An action added to the backend | `satisfies` maps fail type checking; unknown values shown as sent at run time |
| A patient's name read for every entry | Not done: numbers only, with `PatientLink` |
| Many staff accounts | All pages read, 100 at a time; a number field if the read fails |
| Network addresses all the same | H2: the backend doesn't trust the proxy yet. Shown as sent; the legal question stays with the pre-production review |

## Complexity Tracking

| Exception | Why | Simpler alternative rejected because |
|---|---|---|
| `CursorPager` shared with one consumer (Principle IV, IX) | The roadmap and blueprint name it as Phase 11's shared component, and it has nothing audit-specific | Keeping it in `features/audit` would be moved at the next cursor list; the API has only this one today, so it may stay single-use. Recorded so Phase 13's check for unused shared components counts it |
