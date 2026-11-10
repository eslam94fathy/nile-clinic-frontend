# Quickstart: Validating Reports

## Prerequisites

- The backend running with Docker Compose. Check its port with `docker ps`; `BACKEND_API_URL` in `.env.local` holds it.
- `LIVE_ADMIN_EMAIL` and `LIVE_ADMIN_PASSWORD` in `.env.local`, for an account from `php artisan staff:create-admin`.
- Synthetic data only.

## Automated

```powershell
pnpm check          # Every quality check, including unit tests and the fake backend's e2e suite
pnpm test:e2e:live  # Against the running API
```

Both must pass, and only results actually observed are recorded.

## What the unit and component tests must show

| Subject | Expected |
|---|---|
| `readDateRange` | Charges' existing tests pass unchanged after the move |
| `readReportFilters` | No dates gives this month to today; one date gives `missing_*`; reversed and 367 days caught, 366 accepted; invalid dates and ids ignored; `page` defaults to 1 |
| Shortcuts | Correct on 1 January, 31 December, 29 February 2028, and the first of a month, from the clinic's today |
| `toPiastres` | `"0.00"`, `"150.00"`, `"-0.50"`, `"1234567.89"` exact; anything that isn't `SignedMoney` refused |
| No-show rate | Every value from 0.0 to 100.0 shown with one decimal, equal to the value sent, in both languages |
| Chart | Heights for all-positive, all-negative, mixed, one-day, and 366-day periods; a missing day is empty; no chart when every net is zero |
| Each report | Loading, error, forbidden, unknown doctor, refused choices, out of date, empty, and ready; `null` as "Not available", never `0`; new patients replaced by the note with a doctor; negatives marked; both locales |

## What the fake backend's suite must show

| Journey | Expected |
|---|---|
| Open Reports | Redirected to Money collected for this month; one read |
| Shortcuts and dates | Each shortcut sets both dates; Apply reads once; Refresh reads once; nothing on the clock, on focus, or on reconnect |
| Tabs | The period and doctor carry to each report; the page number doesn't; reload and back keep them |
| 367 days, reversed, one date | Told on the date; no request sent |
| `422` forced | The API's message on `to` |
| Unknown doctor | The neutral notice, and "Show all doctors" keeps the period |
| A failed refresh | The figures stay, with the notice |
| Money collected | Totals, chart, by-day table, by method with staff, a negative net marked, an empty period |
| Billing, Activity, Times | Totals stay the same across pages; "Not available" for null values; the new-patients note with a doctor; "Needs attention" labels |
| Receptionist, doctor | No navigation entry; the address gives the forbidden state; no report request sent |
| Accessibility | Axe on all four reports, the empty and error states, in both directions and themes |

## Live journey (`e2e/live/reports.spec.ts`)

1. As the administrator, create synthetic data dated today: a patient, a visit with a charge, a part payment in cash and the rest by
   card, a refund, a no-show appointment, and a seen visit never charged.
2. Read each report for today through the API directly, then open it in the app, and compare every figure shown with the API's answer.
3. Choose the visit's doctor and confirm the new-patients note.
4. Confirm the audit trail gained no entry between before and after opening the four reports.
5. As a receptionist and a doctor, confirm `/reports/billing` shows the forbidden state.
