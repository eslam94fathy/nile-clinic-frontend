# Research: Reports

Findings and decisions for [plan.md](plan.md). Everything about the API was checked in `contracts/reports.openapi.yaml` (identical to the
backend's `specs/010-reports`, at the commit in `contracts/SOURCE.json`) and in the backend's source, `app/Modules/Reports`.

## Facts from the backend

| Fact | Where |
|---|---|
| No report writes an audit entry. The module has no call to the audit trail, and its controller only reads | `app/Modules/Reports` (no reference to `AuditTrail`); `Http/Controllers/ReportController.php` |
| No rate limit on the routes: only `auth:sanctum` | `routes/api.php` in the module |
| Only an active administrator passes; everyone else gets `403`, before validation | `Policies/ReportPolicy.php`, `ReportRequest::authorize` |
| `from`, `to`: required, `Y-m-d`, `to` after or equal to `from`; at most 366 days including both ends, reported on `to` | `Http/Requests/ReportRequest.php` |
| `doctor_id`: optional, integer, at least 1. An unknown doctor is `404`, checked before any figure | `ReportService::assertDoctorExists` |
| `per_page` 1 to 100, default 15. Billing, activity, and times are a standard Laravel page with an extra top-level `totals` | `ReportController`; `->additional(['totals' => …])` |
| Doctors with no activity in the period are left out of the rows. With a doctor filter on such a doctor, the rows are empty and the totals zero | `ReportService`; backend spec, Edge Cases |
| `totals.new_patients` is present only without `doctor_id` | `ReportService::activity` |
| Money collected isn't paged. `by_method` in the order cash, card, wallet; `staff` by name, then id; `by_day` oldest first; only methods and days with movement | Contract, `MoneyCollected` |
| Averages are whole minutes or `null`; the no-show rate a number to one decimal or `null` | Contract, `AverageTime`, `ActivityFigures` |

## R1. How reports read

**Decision:** Reports read in the browser through `useLiveList` with the existing `ON_DEMAND_QUERY` policy, under one root key,
`["reports"]`, inside `LiveQueryProvider`. They read when opened, when a choice or page changes, and on **Refresh**, never by themselves.
`LastRead` shows when the figures on screen were read, offers **Refresh**, and keeps them with a notice when a reread fails. A `403` or
`404` clears the figures and stops, as `useLiveList` already does. Recorded in [ADR 0016](../../docs/decisions/0016-reports-read-on-demand.md).

**Rationale:** The spec asks for the read time, a way to read again, and that a failed reread keeps the figures (FR-016, FR-019). Phase 9
built exactly this for Billing's other dates, and reports aren't audited, which ADR 0015 requires. A server read refreshed with
`router.refresh()` (ADR 0011) would replace the figures with the error state on a failed reread.

**Alternatives:** Server reads under ADR 0011: simpler, but can't keep the figures on a failed reread, and has no read time without
building one. A new policy: nothing about reports differs from `ON_DEMAND_QUERY`.

## R2. Routes and the shared choices

**Decision:**

- The Billing report is titled **Charges by doctor** (clarification 3), as the desk screen is already "Billing"; its slug stays `billing`.
- One optional catch-all page, `/reports/[[...report]]`, where `report` is `money-collected`, `billing`, `activity`, or `times`; anything
  else is the neutral not-found state. `/reports` itself is Money collected, rather than a redirect, which a streamed page could only send
  as a meta tag (changed during implementation). So the single navigation entry opens the
  first report.
- The choices live in the address as `from`, `to`, `doctor_id`, and, on the paged reports, `page` (FR-006). A tab strip, `ReportTabs`, links
  to the other three reports with the same `from`, `to`, and `doctor_id`, and never `page`, as pages belong to one report.
- A choice not in the address takes its default, so a bookmark of `/reports/billing` keeps showing this month as months pass.
- Tab links may be prefetched: no report is audited (spec, Edge Cases). Prefetching a page only fetches its shell; the figures are read in
  the browser after it opens.

- **Mounting.** With a period problem the page renders only the choices: the component that reads isn't mounted, so nothing can be sent, as `useLiveList` has no switch to hold a read. Otherwise each report's component reads and renders `ReportFrame`, which holds the choices, so the read's `422` messages can reach the date fields.
- Applying the default dates unchanged writes them into the address, as Charges does; Reset returns to the moving default.

**Rationale:** The blueprint's `/reports/*`. One page keeps one gate, one header, and one set of choices. Carrying the choices in tab links
rather than in client state makes reload and back work with no extra code (User Story 2).

## R3. The period

**Decision:** `readReportFilters(query, today)` reads the address:

- No dates: this month, from its first day to `today` (clarification 1).
- Only one date: a `missing` problem on the other, and nothing is read.
- An end before the start: `reversed`. More than 366 days including both ends: `too_long`. Nothing is read in either case.
- An invalid date is treated as absent, as Charges does.

The days-including-both-ends count and the range checks move from `features/billing/read-charge-filters.ts` to `lib/format/date-range.ts`
as `readDateRange(query, { maxDays, defaultRange })`. Charges is its first consumer and reports the second (constitution IV). Charges keeps
its behavior: one date alone still means that day there, so that rule is an option, `oneDate: "same-day" | "missing"`, rather than a
change.

Shortcuts are links that set both dates explicitly: today; the last 7 days (today and the six before it); this month (first day to today);
last month (its first to its last day). They're worked out on the server from `clinicToday(CLINIC_TIMEZONE)` with `addDays` and a new
`startOfMonth`, never from the browser's clock (User Story 2, scenario 6). The shortcut matching the current period is marked current, with
`aria-current`, not color alone.

**Rationale:** Charges already measures these rules. The API's message on `to` still appears if it refuses (FR-004), because the frontend's
count is only for faster feedback.

## R4. Exact money and numbers on screen

**Decision:**

- Every amount is the API's string through `Money`, which already accepts a sign (`formatMoney` uses the contract's `SignedMoney`
  pattern). A negative net is written with its minus sign by `Intl`, in both languages, and also carries a visually hidden "negative"
  label, so it never depends on color (FR-012).
- Counts go through `formatCount`. Western digits in both languages, as everywhere (ADR 0008).
- The no-show rate is formatted as a percentage with exactly one decimal from the number sent. `Intl.NumberFormat` with
  `style: "percent"` needs the fraction, `rate / 100`; at one decimal place the rounding recovers the value sent for every value from 0.0
  to 100.0, which a unit test checks exhaustively over all 1,001 values. No other figure is computed.
- Averages are formatted as whole minutes with `Intl.NumberFormat`'s `unit: "minute"`, with the number of visits beside them.
- `null` for an average or rate shows a translated "Not available", never `NoValue`'s dash, which reads as "no value recorded" (FR-013).

**Rationale:** Constitution V and FR-012 to FR-014. The rate isn't money, and the division is only to put a percent sign in the right place
for each language.

## R5. Charts: no library

**Decision:** The one chart, net money by day (clarification 2), is drawn with plain HTML and CSS in a component of this feature,
`MoneyByDayChart`. No charting library is added. Recorded in [ADR 0017](../../docs/decisions/0017-charts-without-a-library.md) and in
`docs/tech-stack.md`, where `recharts` moves from "deferred" to "rejected".

How it's drawn:

- One column per day of the period, up to 366, in a flex row, so the reading direction places the first day at the start in both
  directions with no extra code. Days the API leaves out have no money movement, so their column is empty; no amount is invented for them.
- A zero line. Positive nets rise above it, negative ones fall below it. Each part's height is the largest net on its side, so a period
  with no negative day has no space below the line.
- Heights come from **whole piastres**, read from the API's string digits by a new `toPiastres` in `lib/format/amount.ts`, and compared
  as exact integers. Only the final height, a percentage of the largest, is a fraction, and it labels nothing.
- Labels are the API's own strings: the largest net on each side, shown at its end of the scale, and the first and last dates.
- Colors are tokens: positive bars `primary`, negative bars `status-warning-border` with a hatched fill, so the sign shows by position and
  pattern as well as color. `check:contrast` gains both pairs against `card` at 3:1 (WCAG 1.4.11).
- Accessibility: the chart is `role="img"` with a label naming what it shows and saying the same figures are in the table below it. The
  columns are hidden from assistive technology; each has a `title` with its date and net, for a pointer. The table is the way to read
  every figure, by keyboard or screen reader (FR-008, FR-017, SC-006).

**Rationale:** One bar chart, with no axes beyond a zero line and two labels, is about a hundred lines. A library would bring a large
dependency for one use (constitution IX), work in floating-point numbers internally, and need extra work to follow the reading direction
and the design tokens. Heights from whole piastres keep a bar from disagreeing with its label (spec, Edge Cases).

**Alternatives:**

| Option | Why not |
|---|---|
| `recharts` | Pulls in a set of `d3` packages for one bar chart. Its axes don't follow `dir`, so every chart would need reversing by hand in Arabic. Works in floating-point numbers; its tooltips and focus handling would have to be checked for WCAG |
| An SVG drawn by hand | Works, but doesn't follow the reading direction or wrap labels by itself. HTML and CSS do both |
| No chart (tables only) | The owner chose one chart (clarification 2) |

## R6. Layout of each report

**Decision:**

- **Totals first.** Each report starts with its totals as a list of figures (`dl`), labelled "All doctors" on the paged reports, with the
  period, the doctor if chosen, and the read time above them. They aren't a table row, so paging can't move them (User Story 3,
  scenario 2).
- **Money collected:** totals; then the chart and the by-day table; then by method, each method a `section` with its figures and a table of
  its staff. Neither breakdown is paged.
- **Billing, Activity, Times:** totals; then one `DataTable` of doctors with `pagination`, which shows each row as a list of figures below
  tablet width, as every table here does. Activity has 13 columns, so its header names the group, "Appointments: no-show", rather than
  needing grouped headers, which `DataTable` doesn't have.
- The counts that should stand out, uncharged seen visits, drafts, and no record, gain a `Badge` in the `warning` status tone with a
  text label, "Needs attention", when above zero (User Stories 3 and 5). These are counts, not an API status, so they don't go through
  `statusTones`.
- Each report has one short note under its totals explaining what it counts, for example that cancelled charges are counted only, or how
  the no-show rate is worked out. Translated, never computed.

## R7. States

**Decision:**

| State | When | Shown |
|---|---|---|
| Loading | First read of these choices | `LoadingState` below the choices; the choices stay usable |
| Error | First read failed: no answer, `5xx`, or a body that fails the check | `ErrorState` with **Try again**, which calls `refresh` |
| Forbidden | `403` | `ApiFailureState`, as everywhere |
| Unknown doctor | `404` on a report with `doctor_id` | A neutral notice that the doctor wasn't found, with a link to the same report and period without the doctor |
| Refused choices | `422` | The API's messages on `from`, `to`, or `doctor_id` in the choices; anything else at form level |
| Out of date | A reread failed with figures on screen | The figures, with `LastRead`'s on-demand notice |
| Empty | Money collected with no `by_day` rows; a paged report with no rows | Zero totals, then an `EmptyState` saying nothing happened in the period, in that report's words |
| Beyond the end | A page past `last_page` | Replaced with the last page, as Billing does (spec, Edge Cases) |
| Ready | Otherwise | The report |

`401` is handled by `browserApi`'s existing full sign-out. A choice the frontend refuses (R3) sends nothing and shows the problem on the
date it concerns.

## R8. The doctor choice

**Decision:** The page reads every doctor on the server with `readAllDoctors`, as Billing and Charges do, which includes deactivated
doctors, and labels those "(inactive)", as Billing's and Charges' doctor filters do, with a `reports.inactiveDoctor` message of the
same wording. If the list can't be read, the reports still work without the doctor
choice, as on Billing. A `doctor_id` in the address that isn't in the list is still sent, and the API's `404` decides (FR-002).

## R9. Testing

**Decision:**

- Unit: `readReportFilters` and the moved `readDateRange` (Charges' tests move unchanged); shortcuts at month and year ends and in a leap
  year; `toPiastres`; the percentage formatting over every value from 0.0 to 100.0; the chart's heights for positive, negative, mixed, and
  all-zero periods.
- Component: each report's states, totals, `null` shown as "Not available", the new-patients note, negatives, both locales.
- End to end against the fake backend, which gains the four reports with fixed synthetic figures: each report, the choices carried across
  tabs, reload, and back, the 366-day check, unknown doctor, receptionist and doctor refused, and axe on every report in both directions
  and themes.
- Live: an administrator reads all four for a period holding synthetic payments, a refund, and visits, and compares figures to the API's
  own answer; receptionist and doctor get `403`; the audit trail gains no entry for any report read.
