# Tasks: Reports

**Input**: Design documents from `specs/010-reports/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/api-usage.md](contracts/api-usage.md), [contracts/screens.md](contracts/screens.md), [quickstart.md](quickstart.md), [ADR 0016](../../docs/decisions/0016-reports-read-on-demand.md), [ADR 0017](../../docs/decisions/0017-charts-without-a-library.md)

**Tests**: Required by the constitution (VIII) and the guidelines' testing table. Within a story, tests come first and must fail before the code that satisfies them is written.

**Organization**: By user story, in priority order. US2 (choosing the period and doctor) comes before US1 in the work, because every report needs its choices; together they are the smallest usable slice. Then Billing (US3), Activity (US4), and Times (US5).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: The user story a task belongs to

## Rules for every task

- Check each API detail in [contracts/api-usage.md](contracts/api-usage.md) and `contracts/reports.openapi.yaml`. Never invent one.
- All text goes in both `src/messages/en.json` and `src/messages/ar.json`, with identical keys.
- **Nothing shown is computed.** Every amount, count, average, rate, and total is the API's. Never `Number()`, `parseFloat()`, `+value`, or arithmetic on an amount; the chart's sizes go through `toPiastres` only and label nothing.
- **`null` is "Not available", never `0`, a blank, or `NoValue`'s dash** (FR-013).
- **Reports read only under `ON_DEMAND_QUERY`** (ADR 0016): on opening, on a change of choice or page, and on Refresh or Try again. Never `LIVE_QUERY`, never on a timer, focus, or reconnect.
- **Only `from`, `to`, `doctor_id`, `page`, and the report's slug appear in an address** (FR-006).
- **Branch only on status and the error's field key.** Never compare message text.
- **Clinic dates are shown as sent; shortcuts come from the clinic's today**, worked out on the server. Instants go through `Instant`, in the clinic's zone.
- **Other features are used only through `public.ts`**, except that `app/` pages may import a feature's server read.
- Response bodies are checked by Zod schemas with `satisfies z.ZodType<Generated>`.
- Names are shown as stored, with `UserText`. Methods translated with `shared.paymentMethod`.
- Logical CSS only; colors only from tokens. No `any`. Test data is synthetic.
- Tests use role queries. `getByLabel` needs `.locator("visible=true")` after a soft navigation, as hidden pages stay in the DOM.
- Load the `dataviz` skill before writing the chart (T025).

---

## Phase 1: Setup

- [X] T001 The owner accepted ADR 0016 and ADR 0017 on 2026-11-08. Set both to **Accepted** with the date in `docs/decisions/0016-reports-read-on-demand.md`, `docs/decisions/0017-charts-without-a-library.md`, and `docs/decisions/README.md`. If either is refused, stop and revise the plan
- [X] T002 Confirm that `pnpm check` passes on the branch before any change, and record the observed result in this file. If anything fails, stop and report it rather than working around it. **Observed on 2026-11-08, before any change:** typecheck, lint, format, i18n, styles, contrast (35 pairs), and contracts passed; unit tests 1802 of 1802; e2e 910 of 910 in 37.3 minutes
- [X] T003 Confirm `src/lib/api/generated/reports.ts` matches `contracts/reports.openapi.yaml` with `pnpm contracts:check`, and that it exposes `MoneyCollected`, `MoneyFigures`, `BillingFigures`, `ActivityFigures`, `TimesFigures`, `AverageTime`, and `Doctor`. No change is expected

---

## Phase 2: Foundational (blocks every story)

### Move, with no change of behavior (research R3)

- [X] T004 Move the days-including-both-ends count and the range checks from `src/features/billing/read-charge-filters.ts` to `src/lib/format/date-range.ts` as `readDateRange(query: { from?: string; to?: string }, { today, maxDays, defaultRange, oneDate })`, where `defaultRange` is `{ from, to }`, and `oneDate` is `"same-day"` (Charges: one date alone means that day) or `"missing"` (reports). It returns `{ from, to, problem }` with `problem` one of `null`, `"missing_from"`, `"missing_to"`, `"reversed"`, `"too_long"`; invalid dates through `readClinicDate` count as absent. `readChargeFilters` calls it with `maxDays: 92`, `oneDate: "same-day"`, and the last 7 days, and keeps its own `rangeProblem` values. `src/features/billing/read-charge-filters.test.ts` must pass unchanged. Add `src/lib/format/date-range.test.ts` for the `"missing"` option, 366 and 367 days, and a reversed range
- [X] T005 [P] Write failing tests in `src/lib/format/clinic-today.test.ts`, then add `startOfMonth(date)` and `endOfPreviousMonth(date)` to `src/lib/format/clinic-today.ts`, on clinic-date strings in UTC like `addDays`. Cover 1 January, 31 December, 1 March 2028 (previous month ends 29 February), and 15 November

### Foundations

- [X] T006 [P] Write failing tests in `src/lib/format/amount.test.ts`, then add `toPiastres(value: string): number | null` to `src/lib/format/amount.ts`: accepts only the contract's `SignedMoney`, `^-?\d+\.\d{2}$`, and returns the digits without the dot as an exact integer with its sign, refusing anything beyond `Number.MAX_SAFE_INTEGER`. **No floating-point step**: built from the digit string, never `parseFloat` or `* 100`. Cases: `"0.00"` → 0, `"150.00"` → 15000, `"-0.50"` → -50, `"1234567.89"` → 123456789; `"1.5"`, `"1e3"`, `""`, `"150"` → `null`
- [X] T007 [P] Write failing tests, then add `src/features/reports/types.ts` over `src/lib/api/generated/reports.ts` and `src/features/reports/schemas/reports.ts` with its test: `moneyCollectedSchema` for `{ data: MoneyCollected }`; `billingPageSchema`, `activityPageSchema`, `timesPageSchema` as `{ data: Row[], totals, meta }` with `meta` from `src/lib/api/pagination.ts`. Money fields match `^\d+\.\d{2}$`, `net` matches `^-?\d+\.\d{2}$`; `method` is one of `cash`, `card`, `wallet`; `no_show_rate` is a number or `null`; `average_minutes` an integer or `null`; `doctor.title` a string or `null`; `totals.new_patients` an optional integer, **absent, not zero, when not sent**. Every schema `satisfies z.ZodType<Generated>`. Also export `REPORTS = ["money-collected", "billing", "activity", "times"] as const` and `isReport(slug)`
- [X] T008 Write failing tests, then implement `src/features/reports/read-report-filters.ts` with its test, per data-model's filter table: `readReportFilters(query, today)` returns `{ from, to, doctorId, page, rangeProblem, isDefaultPeriod }` through `readDateRange` with `maxDays: 366`, `oneDate: "missing"`, and the default `{ from: startOfMonth(today), to: today }`. `doctor_id` and `page` through `readPositiveId`, `page` defaulting to 1. Nothing throws. Cover no dates, one date, reversed, 366 and 367 days, invalid values
- [X] T009 Write failing tests, then implement `src/features/reports/shortcuts.ts` with its test: `reportShortcuts(today)` returns `today`, `last7Days` (`addDays(today, -6)` to today), `thisMonth` (`startOfMonth(today)` to today), `lastMonth` (`startOfMonth(endOfPreviousMonth(startOfMonth(today)))` to `endOfPreviousMonth(startOfMonth(today))`), each `{ from, to }`, and `currentShortcut(filters, shortcuts)` naming the one matching both dates, or `thisMonth` when `isDefaultPeriod`. Cover the dates in T005
- [X] T010 [P] Write failing tests, then add `src/features/reports/query-keys.ts`: `REPORTS_ROOT_KEY = ["reports"] as const` and `reportKey(slug, { from, to, doctorId, page })`
- [X] T011 Write failing tests, then implement `src/features/reports/api/reports.ts` with `reports.test.ts`, through `browserApi`: `readMoneyCollected(filters, locale)`, `readBillingReport`, `readActivityReport`, `readTimesReport`. Each sends `from` and `to`, `doctor_id` only when set, `page` only on the paged three, and never `per_page`; checks the body with T007's schemas. Assert that none retries a `4xx`. Not calling them with a `rangeProblem` is the caller's job, tested in T020

### Values

- [X] T012 [P] Write failing tests in `src/features/reports/components/values.test.tsx`, then implement `src/features/reports/components/values.tsx`: `NotAvailable` ("Not available", translated); `NoShowRate({ value })` → `NotAvailable` for `null`, else `Intl.NumberFormat(formattingLocale(locale), { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value / 100)`, with a test over **every value from 0.0 to 100.0 in both locales** showing the value sent; `AverageMinutes({ value, visits })` → whole minutes with `unit: "minute"` and the visits it covers, or `NotAvailable` with the visits; `SignedMoney({ value })` → `Money`, plus a visually hidden "negative" label when it starts with `-`; `NeedsAttention({ count })` → a `Badge` in the `warning` status tone with "Needs attention" when `count` is above 0, else nothing. Counts through `formatCount`
- [X] T013 [P] Implement `src/features/reports/components/figure-list.tsx` with its test: a `dl` of label and value pairs, with an optional heading such as "All doctors", wrapping in rows that stay readable from phone to desktop width with logical CSS only

### Fake backend

- [X] T014 Extend `e2e/support/fake-clinic.mjs` with the four reports, following its existing style. Figures are **seeded by the test** rather than computed, so tests can set exact values, including negatives, `null` averages and rates, an absent `new_patients`, more than 15 doctors for paging, and empty periods. It validates as the real API does: `from` and `to` required as `Y-m-d`, `to` after or equal to `from`, at most 366 days including both ends, refused with `422` under `to`; `doctor_id` unknown → `404`; `403` for receptionists and doctors on every route; `per_page` default 15. It records a count of each report read, with its query, for tests that assert one read per action and none on the clock

**Checkpoint**: `pnpm check` passes, with Charges behaving exactly as before. Record the observed result here.

---

## Phase 3: Access, for every story

- [X] T015 Create `src/app/[locale]/(app)/reports/page.tsx`, which redirects to `/reports/money-collected` with the same query string, and `src/app/[locale]/(app)/reports/[report]/page.tsx` with `ScreenGate` (path `reports`), `Suspense`, `PageHeader`, and `ScopedMessages` (`reports`, `auth`; `shared` is always included), following `src/app/[locale]/(app)/billing/page.tsx`. A slug that isn't in `REPORTS` gives `notFound()`. Set `built: true` for `reports` in `src/lib/auth/app-routes.ts`. Add the `reports.*` messages used so far to both language files, including `reports.inactiveDoctor` as "{name} (inactive)"
- [X] T016 Move every use of `/en/reports` or `/${locale}/reports` as a placeholder for an unbuilt page to `/audit`: `e2e/appointments.spec.ts:132`, `e2e/navigation.spec.ts` (the placeholder checks near lines 97 and 109, keeping the role table near line 64, which tests navigation), and `e2e/accessibility.spec.ts:110`. Then confirm `session-end`, `token-absence`, `auth`, and `navigation` specs pass against the real page, giving the fake backend whatever they now read. Don't weaken any of them
- [X] T017 Create `e2e/reports.spec.ts` with role cases on the fake backend: receptionists and doctors have no Reports in the navigation and get "not allowed" on `/reports` and `/reports/billing`, with zero report reads; an administrator opens all four; `/reports/unknown` is not found (FR-001, FR-002, SC-004)

---

## Phase 4: User Story 2 - Choose the period and the doctor (Priority: P1)

**Goal**: The four reports share a period and an optional doctor, carried in the address, with shortcuts from the clinic's calendar.

**Independent test**: Choose a period and a doctor on one report, move to another, reload, and go back: the choices hold. 367 days is refused before anything is sent.

- [X] T018 [P] [US2] Write failing tests in `src/features/reports/components/report-tabs.test.tsx`, then implement `src/features/reports/components/report-tabs.tsx`: a `nav` with a link per report in `REPORTS` order, each carrying `from` and `to` only when not `isDefaultPeriod`, and `doctor_id` when set, **never `page`**; the current one with `aria-current="page"` and not marked by color alone. Links may be prefetched (research R2)
- [X] T019 [US2] Write failing tests in `src/features/reports/components/report-choices.test.tsx`, then implement `src/features/reports/components/report-choices.tsx` over `FilterBar`: `from` and `to` as date filters and `doctor_id` as a select ("All doctors" first, then each doctor, deactivated ones labelled with `reports.inactiveDoctor`), all `inAddress: true`, with `defaultValue` of the default period's dates; the doctor select is left out when the doctors couldn't be read. Below it, the four shortcuts from T009 as links setting both dates, keeping `doctor_id`, and dropping `page`, the current one with `aria-current`. Applying the default dates unchanged writes them into the address, as Charges does; Reset returns to the moving default. Errors: `missing_from` on `from`, `missing_to`, `reversed`, and `too_long` on `to`, in translated words naming 366 days; the API's `422` messages on `from`, `to`, and `doctor_id`, anything else at form level
- [X] T020 [US2] Write failing tests in `src/features/reports/components/report-frame.test.tsx`, then implement `src/features/reports/components/report-frame.tsx`: given a `LiveList` from `useLiveList`, the filters, and the choices' props, it renders `ReportChoices` with the read's `422` field errors, then the period line (both dates through `ClinicDate`, and the doctor's name when chosen), `LastRead` with `retriesBySelf={false}`, and the states of research R7: loading; error with **Try again** calling `refresh`; `ApiFailureState` for `403`; for `404`, "That doctor wasn't found." with a "Show all doctors" link to the same report and period without `doctor_id`; and children with the figures otherwise, with the out-of-date notice. It is never given a `rangeProblem`: see T021
- [X] T021 [US2] Wire `src/app/[locale]/(app)/reports/[report]/page.tsx`: read the filters with `readReportFilters` and `clinicToday(getEnv().CLINIC_TIMEZONE)`, the shortcuts, and every doctor with `readAllDoctors`; render `ReportTabs`, then **with a `rangeProblem`, only `ReportChoices` with the problem on its date, and no report component, so `useLiveList` is never mounted and nothing is sent**; otherwise, inside `LiveQueryProvider`, the report component for the slug, passing the choices' props and `timeZone`. Until US1 lands, each report renders only `ReportFrame` with no figures
- [X] T022 [US2] Add to `e2e/reports.spec.ts`: opening Reports reads Money collected once for this month; each shortcut sets both dates and reads once; Apply with a doctor reads once; tabs carry the period and doctor and drop the page; reload and back keep them; 367 days, a reversed range, and one date alone are told on the date with **no request sent**; a forced `422` shows the API's message on `to`; an unknown doctor shows the notice, and "Show all doctors" keeps the period; Refresh reads once; Playwright's clock advanced by 10 minutes, focus, and reconnect read nothing; a failed Refresh keeps the figures with the notice. The fake's `script` now takes an optional field, so the forced `422` lands under `errors.to` as the API's would; a refusal with no field is checked to show for the form

**Checkpoint**: The choices work on every report. Run `pnpm check` and record it.

---

## Phase 5: User Story 1 - See the money collected (Priority: P1) 🎯 MVP

**Goal**: Received, refunded, and net for the period, by method with staff, and by day as a chart and a table.

**Independent test**: With seeded figures including a refund on a later day and a negative net, every total and breakdown matches the API exactly, and the chart and table agree.

- [X] T023 [P] [US1] Write failing tests in `src/features/reports/chart-columns.test.ts`, then implement `src/features/reports/chart-columns.ts` per data-model's chart model: `chartColumns({ from, to, byDay })` returns one column per date from `from` to `to` (at most 366), each `{ date, net: string | null, piastres }`, with `null` for a date not in `by_day`; `maxUp`, `maxDown`, the share of height above the line, and each column's height as a fraction of its side; and the labels, which are the **API's own `net` strings** for the days holding `maxUp` and `maxDown`. Cover all positive, all negative, mixed, one day, 366 days, and every net zero (no chart)
- [X] T024 [US1] Write failing tests in `src/features/reports/components/money-collected-report.test.tsx`, then implement `src/features/reports/components/money-collected-report.tsx`: reads with `useLiveList` under `ON_DEMAND_QUERY`, `REPORTS_ROOT_KEY`, and `reportKey("money-collected", …)`, and renders inside `ReportFrame`: totals through `FigureList` (received, refunded, net with `SignedMoney`); with a doctor, the note that only money on that doctor's charges is counted; "By day" with the chart (T025) and a table of date, received, refunded, net, in the API's order; "By method", a `section` per method in the API's order, translated, with its figures and a table of staff (`UserText` names, received, refunded, net). Empty when `by_day` is empty: zero totals, then "No money was received or refunded in this period." When `by_day` has rows but every net is zero, the table shows without a chart, with a line saying no day had a net change Cover a negative net, an amount above a million pounds, 366 rows, and both locales
- [X] T025 [US1] Load the `dataviz` skill. Write failing tests in `src/features/reports/components/money-by-day-chart.test.tsx`, then implement `src/features/reports/components/money-by-day-chart.tsx` per research R5 and ADR 0017: a flex row of columns from `chartColumns`, so `dir` decides the direction; a zero line; positive columns in the `primary` token, negative ones in `status-warning-border` with a hatched fill and below the line; scale labels and the first and last dates from the API's strings; `role="img"` with a translated label saying what it shows and that the same figures are in the table below; columns `aria-hidden`, each with a `title` of its date and net. Logical CSS only, tokens only
- [X] T026 [US1] Add both chart pairs, `primary` on `card` and `status-warning-border` on `card` at 3:1, to `REQUIRED_PAIRS` in `scripts/check-contrast.mjs`, and run `pnpm check:contrast`. If either fails in a theme, add chart tokens to `src/app/globals.css` for both themes that pass, and use those
- [X] T027 [US1] Add to `e2e/reports.spec.ts`: Money collected shows the seeded totals, by method with staff, and by day, with the chart and table agreeing on the number of days with movement; a negative net is marked in English and Arabic; a doctor shows the note; an empty period shows the empty state; the chart starts at the inline start in both directions

**Checkpoint**: The MVP: an administrator can read the money collected for any period, for the clinic or one doctor. Run `pnpm check` and record it.

---

## Phase 6: User Story 3 - Charges by doctor (Priority: P2)

**Goal**: Each doctor's charges, discounts, payments, and balance, with totals for all doctors that stay the same across pages.

**Independent test**: With seeded rows on two pages, every figure matches the API, and the totals don't change between pages.

- [X] T028 [US3] Write failing tests in `src/features/reports/components/billing-report.test.tsx`, then implement `src/features/reports/components/billing-report.tsx`: reads like T024 with `reportKey("billing", …)`; titled "Charges by doctor" in the tab and heading; totals under "All doctors" through `FigureList` (active charges, fees, discounts, amount due, amount paid, balance, cancelled charges, uncharged seen visits with `NeedsAttention`); the note that cancelled charges are counted only and are in no amount; a `DataTable` with a doctor column (`UserText` name, then the title when not `null`) and the same eight figures, with `pagination` from `meta` and `pageHref("/reports/billing", { from, to, doctor_id })` when not the default period; beyond the last page replaced with the last page, as `billing-list.tsx` does. Empty: "Nothing was charged in this period, and no visit was left uncharged."
- [X] T029 [US3] Add to `e2e/reports.spec.ts`: Billing's rows and totals match the seeded figures; page 2 keeps the totals and survives reload and back; "Needs attention" on uncharged seen visits; the empty state

---

## Phase 7: User Story 4 - Activity (Priority: P2)

**Goal**: Appointments by status, the no-show rate, visits by status and type, and new patients.

**Independent test**: Every count and the rate match the API; a `null` rate reads "Not available"; with a doctor, new patients is a note.

- [X] T030 [US4] Write failing tests in `src/features/reports/components/activity-report.test.tsx`, then implement `src/features/reports/components/activity-report.tsx`: reads like T024 with `reportKey("activity", …)`; totals under "All doctors": appointments scheduled, cancelled, no-show, checked in, completed; `NoShowRate`; visits waiting, with the doctor, seen, left, booked, walk-in; and new patients with `formatCount` when present, **or, when absent, the note that the count is for the whole clinic and isn't given for one doctor**; the note on how the no-show rate is worked out; a `DataTable` with headers naming their group ("Appointments: no-show", "Visits: walk-in") and paging as in T028. Empty: "No appointments or visits in this period." Cover a `null` rate (never `0`), and `new_patients: 0` shown as 0, distinct from absent
- [X] T031 [US4] Add to `e2e/reports.spec.ts`: Activity's figures match; a `null` rate reads "Not available"; with a doctor, the new-patients note and no number

---

## Phase 8: User Story 5 - Times and records (Priority: P3)

**Goal**: Average wait and consultation with the visits each covers, and seen visits by record state.

**Independent test**: The averages and counts match the API; a `null` average reads "Not available".

- [X] T032 [US5] Write failing tests in `src/features/reports/components/times-report.test.tsx`, then implement `src/features/reports/components/times-report.tsx`: reads like T024 with `reportKey("times", …)`; totals under "All doctors": `AverageMinutes` for wait and for consultation, and records finalized, draft (`NeedsAttention`), and none (`NeedsAttention`); the note that overall averages are worked out from every visit, not from the doctors' averages; a `DataTable` with the same figures and paging as in T028. Empty: "No visits in this period." Cover `average_minutes: null` with `visits: 0`, and `0` minutes shown as 0
- [X] T033 [US5] Add to `e2e/reports.spec.ts`: Times' figures match; `null` averages read "Not available"; "Needs attention" on drafts and no record

---

## Phase 9: Polish & cross-cutting

- [X] T034 [P] Add the four reports to `e2e/accessibility.spec.ts`, with their ready, empty, error, and unknown-doctor states, in both locales and both themes, axe with no violations (SC-005)
- [X] T035 [P] Create `e2e/live/reports.spec.ts` per quickstart's live journey: synthetic data dated today (a patient, a charged visit paid part in cash and the rest by card, a refund, a no-show, a seen visit never charged); read each report from the API directly, open it in the app, and compare every figure shown; choose the doctor and see the new-patients note; count audit entries before and after opening all four and confirm **no new entry**; receptionist and doctor get the forbidden state on `/reports/billing`. **Not done as written:** the no-show and the seen-but-uncharged visit aren't created, as each needs a past appointment or the doctor's queue, which other live specs share; their counts are still compared with whatever the API returns. Compared: Money collected's three totals for the doctor, every Billing total, Activity's new patients, booked and walk-in visits and no-show rate, and Times' average wait

- [X] T036 [P] Run `pnpm check:i18n` and confirm every `reports.*` key exists in both files; read the Arabic texts for the notes and empty states with the owner's terminology from earlier phases
- [X] T037 Update the documents in plan's "Documents to Update": `docs/tech-stack.md` (`recharts` rejected, ADR 0017), `docs/architecture.md`, `docs/decisions/0015-live-reads-beyond-the-queue.md` (link to 0016), `docs/backend-integration.md` (what the live suite confirmed), `docs/frontend-blueprint.md`, `docs/development-guidelines.md`, and `docs/roadmap.md` (Phase 10 status; charting library decided: none)
- [X] T038 Run `pnpm check` and `pnpm test:e2e:live`, and record the observed results in this file. Report a failure rather than weakening a test. **Observed on 2026-11-10:** the first `pnpm check` failed 2 unit tests in `src/lib/auth/permissions.test.ts`, caused by CRLF line endings written into `docs/backend-integration.md` during this phase; restored to LF. Then `pnpm check` passed: typecheck, lint, format, i18n, styles, contrast (37 pairs), and contracts; unit tests 1936 of 1936; e2e 939 of 939 in 28.6 minutes. `pnpm test:e2e:live` passed 110 of 110 in 14.4 minutes against the local backend at commit `dff2dca`
- [X] T039 Run `/code-review` on the phase's changes, fix what's confirmed, re-run T038's checks, and record the result. Left for the owner by hand: SC-001's timing, a screen reader through one report, and the chart at 366 days in Arabic. **Done on 2026-11-10.** The review gave 10 findings; 7 were confirmed and fixed, each with a test: one doctor's totals were headed "All doctors" (now "This doctor") on Charges by doctor, Activity, and Times; the chart's fixed 2px gaps overflowed a phone at long periods (now 2px up to 31 days, 1px up to 92, none beyond); a missing date's field was filled with the default beside its error; with one date alone, tabs linked to an invented one-day period and "Today" was marked current; `daysIncluding` read years 0 to 99 as 19xx; the chart's highlight was kept by column position, not date; and Money collected's key held a page it never sends. Not changed: Apply writing the default dates into the address (T019 asks for it, as Charges does); the separate every-net-zero check (the schema fixes the format, so it can't disagree with `chartColumns`); the money pattern in three places (fixed by the contract); and reading translations alongside the doctors (no measurable gain). After the fixes, Claude observed typecheck, lint, format, i18n, styles, contrast (37 pairs), contracts, and unit tests 1942 of 1942 pass, before the run was stopped for low memory partway through e2e. **The owner then reported `pnpm check` and `pnpm test:e2e:live` both passing**; their counts weren't recorded. Still left for the owner by hand: SC-001's timing, a screen reader through one report, and the chart at 366 days in Arabic

---

## Dependencies and order

```text
Phase 1 → Phase 2 (move first, alone; then foundations, values, fake) → Phase 3 (access)
                                                                            │
                                                                            ▼
                                                                    US2 (choices)
                                                                            │
                                                                            ▼
                                                                  US1 (money collected) 🎯
                                                                            │
                                                       ┌────────────────────┼────────────────────┐
                                                       ▼                    ▼                    ▼
                                                  US3 (billing)       US4 (activity)        US5 (times)
                                                       └────────────────────┼────────────────────┘
                                                                            ▼
                                                                         Polish
```

- **US2 before US1**: every report renders inside the choices and `ReportFrame`.
- **US3, US4, and US5** each add one component and its tests, and share only `e2e/reports.spec.ts`, so their components can be built alongside each other, with the e2e additions made one after another.
- **The smallest useful slice**: Phases 1 to 5.

## Parallel examples

- Phase 2: T004 lands alone first. Then T005, T006, T007, T010, T012, and T013 alongside each other; T008 and T009 after T005.
- US2: T018 alongside T019.
- US1: T023 alongside T024's tests.
- After US1: T028, T030, and T032 alongside each other.
- Polish: T034, T035, and T036.

## Implementation strategy

1. Finish Phases 1 and 2, confirming at the checkpoint that Charges behaves exactly as before. Stop and report if it can't.
2. Build Phases 3 to 5 for the MVP, running `pnpm check` at the end of each.
3. Add Billing, Activity, and Times.
4. Run the live suite and review only once all stories are in.
