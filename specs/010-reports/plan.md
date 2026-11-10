# Implementation Plan: Reports

**Branch**: `010-reports` | **Date**: 2026-11-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/010-reports/spec.md`

## Summary

Build one Reports page with four reports, Money collected, Billing, Activity, and Times, for administrators, sharing one period and doctor
choice carried in the address.

**The main design point is that nothing on screen is computed.** Every amount, count, average, rate, and total is the API's value, shown
as sent: money as strings, `null` as "Not available", never zero (R4).

**The second is how reports read.** In the browser, on demand, under Phase 9's `onDemand` policy, so each report says when it was read,
offers Refresh, and keeps its figures when a reread fails (R1, ADR 0016).

**The third is the charting decision: no library.** The one chart, net money by day, is HTML and CSS sized from exact whole piastres, with
a table holding the same figures (R5, ADR 0017).

## Technical Context

**Language/Version**: TypeScript 5.9.3, Node 24, React 19.3.1, Next.js 16.4.5 with Cache Components

**Primary Dependencies**: None new. Uses `@tanstack/react-query` 5.106.1 (ADR 0013, 0015), Zod 4.6.7, next-intl 4.14.9. `recharts` is
rejected (ADR 0017)

**Storage**: None. The query cache is memory only, and is never persisted

**Testing**: Vitest and Testing Library; Playwright with axe against the production build and the fake backend, which gains the reports
module; `pnpm test:e2e:live` against the Docker API, with audit counts

**Target Platform**: Modern browsers on desktop and tablet, Chromium tested, as in earlier phases

**Project Type**: Web application, frontend with BFF

**Performance Goals**: A report for any period in under 20 seconds of work (SC-001): a shortcut is one click, a custom period two dates and
Apply. One read per report opened, choice changed, or Refresh; none otherwise. A year of daily rows renders without paging

**Constraints**: Nothing computed from money; money as strings. Only dates, a doctor's number, a page, and the report's name in the
address. Instants in the clinic's time zone; shortcuts from the clinic's calendar. Never compare message text. WCAG 2.2 AA in both
directions and themes, charts included

**Scale/Scope**: 1 new page (`/reports/[[...report]]`, where `/reports` is Money collected), 1 new feature (`reports`), 4 API operations plus 1 reused, 1 piece moved to
a shared place (the date-range rules), 2 new tokens checked for contrast, no new dependency

## Constitution Check

*GATE: Passed before research. Re-checked after design, with the same result.*

| Principle | Status | How |
|---|---|---|
| I. Backend is source of truth | Pass | Every field, filter, order, limit, and refusal checked in the contract and source (research, Facts). Totals are the API's; the frontend adds nothing up. The 366-day check is faster feedback only, and the API's `422` is still shown |
| II. Security and privacy | Pass | No report is audited, confirmed in the source and measured by the live suite. Reports hold no patient data. Only dates and identifiers in addresses. Cache in memory only, cleared by sign-out's full page load. A `403` clears the figures |
| III. Role-based UI is UX | Pass | `reports` already maps to administrators only. `ScreenGate` on the page, so no other role causes a read. The API's `403` is handled regardless |
| IV. Feature-based architecture | Pass | New `features/reports`. The date-range rules move to `lib/format` because reports are their second real consumer; `toPiastres` joins the existing money module. Client Components only where the reading needs them |
| V. Strict typing | Pass | Types from the generated contract; schemas `satisfies z.ZodType<Generated>`. Money never a floating-point number; chart sizes from exact integers, labelling nothing |
| VI. Every state designed | Pass | See [contracts/screens.md](contracts/screens.md) and research R7, including unknown doctor, refused choices, and out of date. No mutations in this phase |
| VII. Bilingual, accessible | Pass | All text in both files. Methods translated; names as stored. The chart follows `dir`, has a table equivalent, and differs by position and pattern as well as color. Axe on every report and state |
| VIII. Tested before done | Pass | See [quickstart.md](quickstart.md), including every role, both locales, and audit counts |
| IX. Simplicity | Pass | No new dependency; a library rejected for one chart. One moved piece, with a real second consumer. No new policy |
| X. Spec-driven | Pass | Full cycle, with two clarifications. ADRs 0016 and 0017 accepted by the owner with this plan |

## Order of Work

1. **Move, with no change of behavior.** The date-range rules from `read-charge-filters.ts` to `lib/format/date-range.ts`. Charges' tests
   must pass unchanged before reports use it.
2. **Foundations.** Schemas and types, the API module, `readReportFilters`, shortcuts, `toPiastres`, the value formatters, and the fake
   backend's reports.
3. **Page shell and access.** `/reports/[[...report]]` with `ScreenGate`, tabs, choices, `built: true`, messages. Role
   access can be tested from here on.
4. **Money collected**, totals and breakdown tables first, then the chart. The smallest usable slice.
5. **Billing**, then **Activity**, then **Times**, sharing the totals list and the paged table.
6. **Live journey, accessibility, documents.**

## Project Structure

### Documentation (this feature)

```text
specs/010-reports/
├── spec.md
├── plan.md                  # This file
├── research.md              # Findings and decisions
├── data-model.md            # Reports, filters, shortcuts, display values, the chart's model
├── quickstart.md            # How to validate, including the live journey
├── contracts/
│   ├── api-usage.md         # API operations, audit effect, and refusals
│   └── screens.md           # Each report's contents and states
├── checklists/requirements.md
└── tasks.md                 # Next step: /speckit-tasks
```

### Source Code

```text
src/
├── app/[locale]/(app)/reports/
│   └── [[...report]]/page.tsx              # Gate, slug check (none is Money collected), filters and shortcuts, doctors, the report in the provider
├── features/reports/
│   ├── api/reports.ts                      # Browser: the four reads
│   ├── components/
│   │   ├── report-tabs.tsx                 # Links carrying from, to, doctor_id
│   │   ├── report-choices.tsx              # FilterBar for the period and doctor, shortcuts, problems on the dates
│   │   ├── report-frame.tsx                # Choices with the read's 422s, period line, LastRead, and the shared states
│   │   ├── figure-list.tsx                 # Totals as a description list
│   │   ├── money-collected-report.tsx
│   │   ├── money-by-day-chart.tsx
│   │   ├── billing-report.tsx
│   │   ├── activity-report.tsx
│   │   ├── times-report.tsx
│   │   └── values.tsx                      # NoShowRate, AverageMinutes, NotAvailable, NeedsAttention
│   ├── schemas/reports.ts
│   ├── read-report-filters.ts
│   ├── shortcuts.ts
│   ├── chart-columns.ts                    # The chart's model, tested apart from rendering
│   ├── query-keys.ts
│   └── types.ts
├── features/billing/read-charge-filters.ts # Uses lib/format/date-range.ts; behavior unchanged
├── lib/
│   ├── format/date-range.ts                # Moved: days including both ends, range problems
│   ├── format/clinic-today.ts              # Gains startOfMonth, endOfPreviousMonth
│   ├── format/amount.ts                    # Gains toPiastres
│   └── auth/app-routes.ts                  # `built: true` on reports
├── app/globals.css                         # Chart tokens, if primary and the warning border don't pass 3:1 on card
└── messages/{en,ar}.json                   # reports.*

scripts/check-contrast.mjs                  # Gains the chart's pairs

e2e/
├── reports.spec.ts                         # Reports, choices, tabs, states, roles
├── accessibility.spec.ts                   # Gains the four reports and their states
├── support/fake-clinic.mjs                 # Gains the four reports
└── live/reports.spec.ts                    # Figures against the API, roles, audit counts
```

**Structure Decision**: One new feature, `reports`, matching the backend's Reports module. Only the date-range rules move, landing first
and alone, so a regression shows in Charges' own tests.

## Decisions to Record

- **[ADR 0016](../../docs/decisions/0016-reports-read-on-demand.md)**, accepted: reports read in the browser under `onDemand`. Extends
  ADR 0015.
- **[ADR 0017](../../docs/decisions/0017-charts-without-a-library.md)**, accepted: no charting library; `recharts` rejected.

Both accepted by the owner on 2026-11-08.

## Documents to Update

| File | Change |
|---|---|
| `docs/tech-stack.md` | `recharts` from deferred to rejected, citing ADR 0017 |
| `docs/architecture.md` | The reports feature, ADR 0016 among the reads on demand, and the chart approach |
| `docs/decisions/README.md` | ADRs 0016 and 0017 listed (done), statuses updated on acceptance |
| `docs/decisions/0015-…` | A link forward to 0016 |
| `docs/backend-integration.md` | What the live suite confirms about reports: no audit entries, no rate limit, doctors without activity left out |
| `docs/frontend-blueprint.md` | `/reports/*` as built. Status line |
| `docs/development-guidelines.md` | Shown figures come from the API, never computed; how a chart sizes from money |
| `docs/roadmap.md` | Phase status, and "charting library decided: none" |

## Risks

| Risk | Mitigation |
|---|---|
| A figure computed or rounded by the frontend | Nothing is computed; `null` handled in one place; tests compare every figure to the API's |
| A missing value shown as zero | `NotAvailable` used for every nullable figure, with tests for each |
| A bar disagreeing with its label | Heights from exact piastres; labels are the API's strings; tests for mixed and one-day periods |
| A year of days unreadable in the chart | Columns shrink to fit and the table holds every figure; tested at 366 days in both directions |
| Shortcuts off by a day at month or year ends | Clinic-date arithmetic in UTC on strings; tests at 1 January, 31 December, and 29 February |
| The move changes Charges' behavior | Moved first, alone, with Charges' tests unchanged and passing |
| Wide Activity table on a tablet | `DataTable` scrolls inside its container, and becomes a list of figures below tablet width |
| A demoted administrator keeps figures on screen | A `403` on the next read clears them, as `useLiveList` does |
| The clinic's clock in the frontend differs from the backend's | H4. Only the default period and the shortcuts could differ |

## Complexity Tracking

No exceptions to the constitution.
