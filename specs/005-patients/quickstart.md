# Quickstart: Validating Patients

## Prerequisites

- The backend running in Docker. Its port varies, so check `docker ps`. `BACKEND_API_URL` in `.env.local` holds it.
- `LIVE_ADMIN_EMAIL` and `LIVE_ADMIN_PASSWORD` in `.env.local`, for a synthetic administrator. Live tests create their own receptionist and doctor.
- Synthetic data only, including in anything typed by hand.

## Automated checks

```powershell
pnpm check            # Every quality check, including unit tests, the fake-backend end-to-end suite, and accessibility
pnpm test:e2e:live    # The real API, including the opening counts below
```

## The opening count (SC-003)

The most important check in this phase. `e2e/live/patients.spec.ts` runs this on a **production build**, counting entries with `GET /audit-entries?patient_id=<id>&action=patient.opened`.

| Step | Expected entries |
|---|---|
| Search; results shown; hover over a result | 0 |
| Click a result | 1 |
| Leave and return to the tab | 1 |
| Go to the search by link, then press back | 1 |
| Save a change on another feature's page, then go back to the record | 1 |
| Click the same result again | 2 |
| Ctrl+click it: the new tab reads | 3 |
| Back in the first tab | 3 |
| Edit, change a phone, save | 3, plus one `patient.updated` |
| Edit, change nothing, save | 3, and no request is sent |
| "Reload details" | 4 |
| Reload the page | 5 |
| Switch language | 6 |

Registering separately: `patient.registered` once, with 0 openings; reload then gives 1.

## Manual scenarios

Run each in `/ar` and `/en`, and in light and dark:

1. **Arabic-aware search**: register `أحمد` and `هبة`, then find them with `احمد` and `هبه`.
2. **Shared phone**: register two synthetic patients with one phone. The second shows the first as a possible match, then "Register anyway" succeeds.
3. **Nothing in the address**: after each search, the address stays `/patients`, and browser history shows no terms. Reloading clears them.
4. **Back restores**: search, open a patient, press back. Terms and results are there.
5. **Results update**: search, open a patient, change the name, press back. The row shows the new name.
6. **Clearing**: clear an address and all three parts of an emergency contact. Each then reads "not recorded".
7. **Refusals**: a repeated national ID, a future date, a malformed phone, and one part of an emergency contact.
8. **Arabic digits**: type a phone and a patient number in Arabic digits.
9. **Doctor**: no navigation entry, and `/patients`, `/patients/new`, and `/patients/5` show "not allowed", with no `/patients` request.
10. **Sign-out**: after signing out, back shows no patient data, and browser storage holds none.

## What to confirm in the network panel

- `/api/backend/patients/<id>` appears once per opening, and never on hovering or returning.
- `/api/backend/patients?…` appears only on submitting.
- No document or data request carries a search term.
