# Quickstart: Validating Appointments

## Prerequisites

- The backend running with Docker Compose. Check its port with `docker ps`; `BACKEND_API_URL` in `.env.local` holds it.
- `LIVE_ADMIN_EMAIL` and `LIVE_ADMIN_PASSWORD` in `.env.local`, for an account from `php artisan staff:create-admin`.
- Synthetic data only.

## Automated

```powershell
pnpm check          # Every quality check, including unit tests and the fake backend's e2e suite
pnpm test:e2e:live  # Against the running API
```

Both must pass, and only results actually observed are recorded. The live suite takes up to about six minutes longer than before, because the no-show test waits for a real start to pass ([research R10](research.md)). If it skipped because the clinic's day was ending, that must be reported, and the run repeated at another time.

## What the live suite must show

Using synthetic patients and a dedicated synthetic doctor:

| Journey | Expected |
|---|---|
| Book through the page | `201`; the time stops being offered; `appointment.booked` once; `patient.opened` unchanged |
| Book from a patient's page | The patient is carried; opening count unchanged after following either link |
| Two bookings of one time at once | Exactly one `201`, the other `409` with `slot_booked` |
| Same patient, overlapping time, other doctor | `409` with `patient_busy` shown, with the link |
| Filter by patient, doctor, status, range | Matches; survives a reload and back |
| A range over 92 days | The API's message on the filter |
| Reschedule | Same number; old time offered again; `appointment.rescheduled` once |
| Cancel with a reason | Status, reason, and who are shown; time offered again; `appointment.cancelled` once |
| Time off covering a booking | The label shows, "Needing a move" finds it, and moving removes it |
| No-show before the start, forced | The API's refusal shows at page level |
| No-show after a real start passes | Status and who are shown; `appointment.no_show` once |
| Doctor's own list | Only their appointments, no phone, no actions |
| Another doctor's appointment, by address | Neutral not-found |
| After the whole journey | No synthetic term, note, or reason in the address history, browser storage, or the server's logs |

## By hand

Check once in `en` and once in `ar`, in both themes:

1. **The clock of a slot**: book a time, and check it reads the same on the appointment's page and in the API's response, on a computer set to another time zone.
2. **Keyboard**: book, reschedule, cancel, and mark a no-show with no mouse. After each, focus should land on the page's heading.
3. **Screen reader**: each free time announces its date and time.
4. **Shared computer**: sign out after a booking, press back, and confirm nothing appears.
5. **Timing**: time a booking of a known patient from the Appointments page, under one minute (SC-001).

## Permissions

| Screen or action | A | R | D |
|---|---|---|---|
| `/appointments`, `/appointments/new`, `/appointments/[id]` | ✓ | ✓ | Not allowed, with no read |
| Book, reschedule, cancel, no-show | ✓ | ✓ | `403` if forced |
| `/my/appointments`, `/my/appointments/[id]` | Not allowed | Not allowed | ✓ |

`e2e/appointments.spec.ts` compares each cell on the fake backend, and the live suite repeats a forced `403`.
