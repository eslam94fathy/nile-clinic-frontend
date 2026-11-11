# Data Model: Role Dashboards

**Feature**: 012-role-dashboards | **Date**: 2026-11-11

The dashboards hold no data of their own and change nothing. Everything below is a shape read from an existing endpoint and kept in the
in-memory query cache under `["dashboard", …]`, cleared at sign-out and on `401` by the full page load (ADR 0013).

## Common

| Name | Shape | Notes |
|---|---|---|
| `Count` | `number` | `meta.total` of a page read with `per_page=1`, or the length of a list the API returns whole |
| `ShortList<Row>` | `{ rows: Row[]; total: number }` | One page with `per_page=5`; `total - rows.length` is "and N more" |
| `Today` | `string` (`YYYY-MM-DD`) | `clinicToday(CLINIC_TIMEZONE)` when the read runs, and returned with the panel's figures. Not in the query key (research R6) |
| `PanelRead<T>` | `LiveList<T>` from `lib/api/use-live-list.ts` | `data`, `failure`, `outOfDate`, `reading`, `readAt`, `refresh` |

A panel's read succeeds only if all its requests do (research R3). Its failure is the first of `401`, `403`, `404`, then any other, so a
refusal is never hidden behind a server error.

## Receptionist

| Panel | Data | Requests |
|---|---|---|
| `TodaysAppointments` | `{ toArrive: ShortList<AppointmentRow>; arrived: Count; completed: Count; noShow: Count }` | `GET /appointments?from=T&to=T&status=scheduled&per_page=5`; the same with `status=checked_in`, `completed`, `no_show` and `per_page=1` |
| `QueueByStatus` | `{ waiting: Count; withDoctor: Count; seen: Count; left: Count }` | `GET /queue?status=waiting&per_page=1`, and `with_doctor`, `seen`, `left` |
| `MoneyOwed` | `{ notCharged: Count; unpaid: Count; partlyPaid: Count }` | `GET /visits?date=T&charge_status=none&per_page=1`, and `unpaid`, `partially_paid` |
| `NeedingAMove` | `{ list: ShortList<AppointmentRow>; from: Today; to: string }` | `GET /appointments?from=T&to=T+90&outside_availability=1&per_page=5` |

`AppointmentRow` = `Pick<AppointmentSummary, "id" | "date" | "start" | "end"> & { patient: { full_name }; doctor: { name, title } }`,
checked against the generated `AppointmentSummary`. No status is kept, as every row is scheduled, and no phone, though the list
returns one.

## Doctor

| Panel | Data | Requests |
|---|---|---|
| `WithMeNow` and `Waiting` (one read) | `{ current: OwnQueueRow \| null; waiting: OwnQueueRow[] }` | `GET /doctors/me/queue` |
| `NextAppointments` | `ShortList<OwnAppointmentRow>` | `GET /doctors/me/appointments?from=T&to=T&status=scheduled&per_page=5` |
| `Records` | `{ none: Count; draft: Count; from: string; to: Today }` | `GET /doctors/me/visits?from=T-91&to=T&record_status=none&per_page=1`, and `draft` |

- `OwnQueueRow` = `Pick<OwnQueueEntry, "id" | "queue_number" | "status" | "called_at"> & { patient: { full_name } }`.
  `current` is the entry with status `with_doctor` (at most one, by the API's rule); `waiting` keeps the API's queue order and is shown in
  full, not capped at five, as the API returns the whole list (the spec's one exception to five rows). Seen and left entries
  aren't used.
- `OwnAppointmentRow` = `Pick<OwnAppointmentSummary, "id" | "date" | "start" | "end"> & { patient: { full_name } }`.
- `T-91` to `T` is 92 days with both ends, the API's limit (clarified 2026-11-11).

The two panels from one read share one `useLiveList`, so they can't disagree; each still has its own heading and empty state.

## Administrator

| Panel | Data | Requests |
|---|---|---|
| `MoneyToday` | `Pick<MoneyCollected, "totals" \| "by_method">` | `GET /reports/money-collected?from=T&to=T` |
| `ActivityToday` | `ActivityTotals` (appointments by status, visits by status, `no_show_rate`, `new_patients`) | `GET /reports/activity?from=T&to=T` (page 1; only `totals` is used) |
| `NeedingAMove` | as the receptionist's | as the receptionist's |

Money fields stay strings (`received`, `refunded`, `net`, which can be negative). `no_show_rate` is `number | null`, shown as sent.

## State of a panel

```text
             ┌──────────── first read ────────────┐
 loading ────┤                                    ├──► failed (no data) ── Try again ──► loading
             └──► shown ── later read fails ──► shown, out of date ── next read ok ──► shown
                    │
                    └── 403 ──► forbidden (data cleared, no more reads)
                    └── 404 ──► not found (data cleared, no more reads)
                    └── 401 ──► the app's session-end flow (whole page)
```

"Empty" is a `shown` panel whose figures are all zero and whose list is empty; it has its own words (contracts/screens.md).
