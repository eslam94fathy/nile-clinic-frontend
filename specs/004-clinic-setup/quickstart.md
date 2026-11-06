# Quickstart: Validating Clinic Setup

## Prerequisites

- The backend running in Docker, with `BACKEND_API_URL` in `.env.local` pointing at it. Check the port with `docker ps`.
- `LIVE_ADMIN_EMAIL` and `LIVE_ADMIN_PASSWORD` in `.env.local`, for a synthetic administrator made with `php artisan staff:create-admin`.

## Automated

```powershell
pnpm check            # Every quality check, unit tests, and end-to-end tests against the fake backend
pnpm test:e2e:live    # The journey and session endings against the real API
```

## What must be proven

| Scenario | Where | Expected |
|---|---|---|
| The whole journey: new account, profile, hours, fee | `e2e/live/clinic-setup.spec.ts` | "Setup complete", with slots from the API, in English and in Arabic |
| Slots but no fee | Same | "Bookable", no "setup complete", and the charge warning |
| Deactivating an account, and setting its password | Same | That person's next page load goes to sign-in |
| An administrator deactivating or demoting themselves | Same | Sign-in, or "not allowed", with a warning first |
| Each role against every new page and control | `e2e/clinic-roles.spec.ts` | Agrees with the matrix. "Not allowed" pages lack the page's text |
| A list opened before a change, returned to by link and by back button | `e2e/clinic-roles.spec.ts` | New data, as in research R1 |
| Each form's refusals | Component tests and per-feature end-to-end specs | On the right field, or at form level, none dropped |
| Schedule refusals by row | `e2e/schedule.spec.ts`, and live | Against the exact period, with entries kept |
| `24:00` | `e2e/schedule.spec.ts`, and live | Entered, saved, and shown as `24:00` |
| One section failing on the doctor's page | `e2e/doctors.spec.ts` | Error and retry in that section. The rest work. Readiness shows unknown and claims nothing |
| Fee exactness | Unit, and live | A value such as `350.10` is shown exactly |
| Arabic digits in fee and time fields | Unit, and `e2e/fees.spec.ts` | Accepted, and sent as Western digits |
| All new screens in both directions and themes | `e2e/accessibility.spec.ts` | No WCAG 2.2 AA violations |
| The setup journey by keyboard alone | `e2e/doctors.spec.ts` | Completes |

## By hand, once

1. Sign in as an administrator in Arabic. Create a specialty, then a doctor-role account, and follow the offers through to "setup complete". Time it (SC-001: under 5 minutes).
2. Open that doctor's page as a receptionist, and confirm that no controls appear.
3. Sign in as that doctor, and open "My schedule".
4. Record time off, and confirm that the slots change. Remove it, and confirm that they return.
5. Check a tablet width in both directions, especially the schedule editor.

Record the results in `tasks.md`, reporting only what was actually run.
