# Quickstart: Validating the Queue

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

## What the fake backend's suite must show

Using Playwright's clock, apart from one real interval.

| Journey | Expected |
|---|---|
| A list left visible | One read per 15 seconds, and a change appears with no loading state |
| Moving to another page in the application for 2 minutes | No reads. One read on returning (R2, measured first) |
| Hiding the tab | No reads. One read on showing it |
| Failed refresh, then recovery | The list stays with the notice, and the notice clears by itself |
| A browser reporting itself offline | The notice appears, rather than a silent pause |
| First read fails | The error state, and "Try again" works |
| `403` during a refresh | "Not allowed", no patient details in the page, no more reads |
| `401` during a refresh | The sign-in redirect, with no patient number in the return address |
| A row changing while its dialog is open | The dialog stays, with its text unchanged, and the API's refusal appears on confirming |
| A row disappearing while it has focus | Focus moves to the heading, not to nothing |
| A page that no longer exists | The last page that does |
| Doctor and status together | Only matching rows, in the API's order |
| Every refusal in [contracts/api-usage.md](contracts/api-usage.md) | In the right place, in both languages |
| An unknown outcome, for each action | Says so, and reads again |
| Every role, every page | Matches the table below |
| Axe | No violations on `/queue`, `/queue/walk-in`, `/my/queue`, in both languages and directions |

## What the live suite must show

Using synthetic patients and dedicated synthetic doctors. Two browser contexts act as two computers.

| Journey | Expected |
|---|---|
| Check in from the page | `201`; number in the confirmation; `visit.checked_in` once; `patient.opened` unchanged |
| Check in again, forced | The API's refusal at page level |
| Appointment on another date, check-in forced | `422` under `appointment` |
| Two check-ins of one appointment at once | One `201`, and the other refused. One row |
| Reception's list | Rows hold exactly the contract's fields, grouped and in the API's order |
| Filters | Match; survive a reload and back |
| Walk-in | `201`; "walk-in" label; free times unchanged; `visit.walk_in_added` once |
| Same patient again | `422` under `patient_id`, shown on the patient |
| Carried from a patient's page | The patient is chosen, and the opening count is unchanged |
| Mark as left | Row stays, with its time; never called; `visit.left` once |
| Undo check-in | Row gone; appointment scheduled; `visit.check_in_undone` once; a new check-in gets a new number |
| Call next | First waiting becomes current; `visit.called` once; no contact detail on the page |
| Call next while with someone, forced | `422` under `queue` |
| Finish | Seen; appointment completed; `visit.finished` once |
| Finish with nobody current, forced | `422` under `queue` |
| Reception sees the doctor's change, and the reverse | Within 20 seconds, with no interaction (SC-002) |
| Several minutes of refreshing, read through the audit trail | No entries from reading. `patient.opened` only from a followed link (SC-004) |
| A doctor on `/queue` routes, forced | `403` |
| Reception on `/doctors/me/queue` routes, forced | `403` |
| After the whole journey | No synthetic term or patient detail in the address history, browser storage, or the server's logs |

## By hand

Check once in `en` and once in `ar`, in both themes:

1. **Two real computers**: keep the Queue page on one, and act on another.
2. **Keyboard**: check in, add a walk-in, mark as left, undo, call next, and finish with no mouse. Check where focus lands after each.
3. **Screen reader**: leave a list on for a minute, and confirm it doesn't speak on each refresh. Confirm a person's own action is announced.
4. **Shared computer**: sign out with a list on screen, press back, and confirm nothing appears.
5. **Timing**: check in a patient from the Appointments page in under 30 seconds (SC-001).
6. **Sleep**: put the computer to sleep with a list on screen, wake it, and check it reads at once.

## Permissions

| Screen or action | A | R | D |
|---|---|---|---|
| `/queue`, `/queue/walk-in` | ✓ | ✓ | Not allowed, with no read |
| Check in, walk-in, left, undo | ✓ | ✓ | `403` if forced |
| `/my/queue` | Not allowed | Not allowed | ✓ |
| Call next, finish | `403` if forced | `403` if forced | ✓ |

`e2e/queue.spec.ts` compares each cell on the fake backend, and the live suite repeats a forced `403`.
