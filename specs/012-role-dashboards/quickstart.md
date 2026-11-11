# Quickstart: Role Dashboards

**Feature**: 012-role-dashboards

How to show the feature works. Only results actually observed are reported in the PR.

## Prerequisites

- `pnpm install`; `.env.local` with `BACKEND_API_URL` (check the port with `docker ps`) and `CLINIC_TIMEZONE`, the same as the backend's.
- For the live suite: the backend running with Docker Compose at commit `dff2dca`, and the accounts `e2e/live/setup.ts` creates.

## Checks

```sh
pnpm check            # types, lint, unit tests, contracts, build, fake-backend e2e and accessibility
pnpm test:e2e:live    # needs the backend
```

## Scenarios

| # | Scenario | Expected | Where |
|---|---|---|---|
| 1 | Receptionist opens the dashboard with synthetic data for today | Four panels; each figure equals the linked screen's count for the same filter | `e2e/dashboard.spec.ts`, `e2e/live/dashboard.spec.ts` |
| 2 | Follow each receptionist link and row | Appointments today (scheduled), Queue by status, Billing by charge status, needing a move, an appointment's page | `e2e/dashboard.spec.ts` |
| 3 | Doctor with one patient with them, three waiting, later appointments, visits without a record and with a draft | The patient, three in queue order, the next appointments, two record counts over 92 days | both |
| 4 | Doctor without a profile | The existing "profile not set up" state; no dashboard request made | `e2e/dashboard.spec.ts` |
| 5 | Administrator with payments by two methods, refunds, and activity today | Money and activity equal the reports for today, money exactly as sent | both |
| 6 | One panel's read fails, then is refused, then not found (`page.route`) | Only that panel shows failed, forbidden, not found; others show figures; Try again reads only that panel | `e2e/dashboard.spec.ts` |
| 7 | Receptionist or doctor dashboard left visible for two intervals, then hidden for two | Reads again each 15 seconds while visible, none while hidden | `e2e/dashboard.spec.ts` |
| 8 | Administrator dashboard left open for two intervals | No read until Refresh | `e2e/dashboard.spec.ts` |
| 9 | Each role opens, refreshes, and leaves open its dashboard | No audit entry of any kind is written; no request to an audited path | `e2e/live/dashboard.spec.ts` |
| 10 | Each panel's states, both locales, both themes, narrow and desk widths | No axe violations; numbers and money left-to-right in Arabic | `e2e/accessibility.spec.ts` |
| 11 | Midnight in the clinic's time zone passes with the page open (test clock) | The next read uses the new date | unit tests |
| 12 | Sign out with a dashboard open, then sign in as another role | The new role's panels only; no figure from the previous session | `e2e/dashboard.spec.ts` |

## By hand

Sign in as each role in `/ar` and `/en`, then compare each figure with its linked screen.
