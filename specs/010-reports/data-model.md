# Data Model: Reports

The frontend stores nothing. Every figure is the API's, as defined in `contracts/reports.openapi.yaml` and the backend's
`specs/010-reports/data-model.md`. Types come from `src/lib/api/generated/reports.ts`; schemas are written with
`satisfies z.ZodType<Generated>`, as in every feature.

## Report

| Slug (address) | Operation | Paged | Body |
|---|---|---|---|
| `money-collected` | `GET /reports/money-collected` | No | `{ data: MoneyCollected }` |
| `billing` | `GET /reports/billing` | Yes | `{ data: BillingRow[], totals: BillingFigures, meta }` |
| `activity` | `GET /reports/activity` | Yes | `{ data: ActivityRow[], totals: ActivityFigures & { new_patients? }, meta }` |
| `times` | `GET /reports/times` | Yes | `{ data: TimesRow[], totals: TimesFigures, meta }` |

`REPORTS = ["money-collected", "billing", "activity", "times"] as const`, in tab order. A slug outside it is not found.

## Report filters (from the address)

| Field | Address | Rule |
|---|---|---|
| `from` | `from` | A real clinic date, or absent. Absent with `to` absent: the first day of the clinic's month |
| `to` | `to` | A real clinic date, or absent. Absent with `from` absent: the clinic's today |
| `doctorId` | `doctor_id` | A positive integer, or `null`. Not checked against the list; the API's `404` decides |
| `page` | `page` | A positive integer, default 1. Ignored by Money collected, and never carried between reports |
| `rangeProblem` | — | `null`, `missing_from`, `missing_to`, `reversed`, or `too_long` (more than 366 days, both ends included) |
| `isDefaultPeriod` | — | Neither date was in the address. Tab links then leave the dates out too |

With a `rangeProblem`, nothing is read, and the problem is shown on the date it concerns: `missing_from` on `from`, the rest on `to`,
where the API reports its own range message.

## Shortcuts

Worked out on the server from the clinic's today, `T`, with `addDays` and `startOfMonth` on clinic-date strings, never `Date` in local
time.

| Shortcut | `from` | `to` |
|---|---|---|
| Today | `T` | `T` |
| Last 7 days | `T - 6` | `T` |
| This month | first day of `T`'s month | `T` |
| Last month | first day of the month before | the day before this month's first day |

A shortcut is current when both dates match it, or, for "This month", when the period is the default.

## Query keys

`REPORTS_ROOT_KEY = ["reports"]`. Each read is `["reports", slug, { from, to, doctorId, page }]`, so **Refresh** rereads only the report
on screen, and a change of choice is a new query. No other feature's key starts with `"reports"`.

## Display values

| API value | Shown as |
|---|---|
| `Money`, `SignedMoney` string | `Money`, exactly; a negative also has a hidden "negative" label |
| Count (integer) | `formatCount` |
| `no_show_rate`: number | A percentage with one decimal, from the number sent (research R4) |
| `no_show_rate`: `null` | "Not available" |
| `average_minutes`: integer | Whole minutes, with `visits` beside: "12 minutes, over 40 visits" |
| `average_minutes`: `null` | "Not available", with `visits` (0) beside |
| `totals.new_patients` present | `formatCount` |
| `totals.new_patients` absent | A note that the count is for the whole clinic and isn't given for one doctor |
| `method` | Translated with the existing `shared.paymentMethod` messages |
| `doctor.name`, `doctor.title`, staff `name` | As stored, `UserText`, `dir="auto"`. A `null` title shows the name alone |
| `date` | `ClinicDate`, as sent |

## Chart model

`MoneyByDayChart` takes `from`, `to`, and `by_day`. It builds one column per date from `from` to `to` (at most 366). A date found in
`by_day` gets that day's `net`; the rest are empty.

| Value | How |
|---|---|
| A column's size | `toPiastres(net)`: the string's digits as an exact integer, with its sign |
| `maxUp` | The largest positive piastres, or 0 |
| `maxDown` | The largest negative piastres' magnitude, or 0 |
| Height above the line | `net / maxUp` of the upper part, which takes `maxUp / (maxUp + maxDown)` of the chart |
| Height below the line | `|net| / maxDown` of the lower part |
| Scale labels | The API's own `net` strings for the days holding `maxUp` and `maxDown`, and `from` and `to` |

When `by_day` is empty, the report's empty state stands instead of the chart and table. When `by_day` has rows but every net is zero, for example a payment refunded in full on the same day, no chart is drawn: the by-day table still shows, with a line saying no day had a net change. The fractions only size columns:
no figure shown is computed.
