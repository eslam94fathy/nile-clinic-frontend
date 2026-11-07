# Screens: Appointments

Every screen has loading, error, empty, and success states, in both languages and directions. `ScreenGate` decides access on the server before any read. Links use `prefetch={false}`.

## `/appointments` (A R)

**Header**: title, description, "Book appointment".

**View**: two links, "All" and "Needing a move". The second drops `from`, `to`, and `page`, and adds `outside_availability=1`. The current one is marked with `aria-current`.

**Patient filter**: if `patient_id` is set, the patient's number, name, and phone, with a "Clear" link. If not, a "Filter by patient" button opens `PatientChooser` in place. Choosing sets `patient_id`, and drops `from`, `to`, and `page`.

**FilterBar**: From, To, Doctor, Status, all in the address.

**Table columns**: Date; Time, as `start` to `end`, linking to the appointment; Patient, with number, name, and phone; Doctor, with name and title; Status, with the "outside availability" label beside it when true. Paged by the API's totals.

| State | Shown |
|---|---|
| Loading | `LoadingState` in `Suspense` |
| Empty, unfiltered today | "No appointments today", with "Book appointment" |
| Empty, filtered | "No appointments match", filters kept, with "Book appointment" |
| Empty, needing a move | "Nothing needs moving" |
| `422` | The API's message on the matching filter, otherwise at form level. The bar stays usable |
| `403` | `ForbiddenState`, with no rows |
| Other failure | `ErrorState` with retry |

## `/appointments/new` (A R)

Three parts in order, always visible, each saying what it needs next. Nothing below is offered until the part above is done.

1. **Patient**: `PatientChooser`, or the chosen patient with "Change". Carried by `?patient_id=N`. If that finds nobody, the search appears with a message saying so. No match offers "Register a new patient".
2. **Doctor**: `DoctorChooser`, with name and specialty, listing active doctors by name, title, and specialties. "Change" clears the chosen time.
3. **Time**: `FreeTimes`, then **Note** with the "no medical details" hint, then **Book**.

| State | Shown |
|---|---|
| Patient lookup or doctors reading | `LoadingState` in that part |
| Lookup or doctors failed | `ErrorState` with retry, in that part. Other parts stay as they are |
| Submitting | Button shows progress; a second press does nothing |
| Refused about the time | Message, free times read again, time cleared. Patient, doctor, and note kept |
| `patient_busy` | Also a link to `/appointments?patient_id=N&from=D&to=D` |
| Outcome unknown | Says it can't tell if it was saved, with a link to the patient's appointments |
| Booked | Toast, moves to the appointment's page, form reset |

## `FreeTimes` (shared by booking and rescheduling)

Date field, "Previous week", "Next week", "Refresh". Free times grouped under each date, as native radios named by date and time. No week is offered past either limit.

| State | Shown |
|---|---|
| Reading | `LoadingState`, with the controls still present |
| No free times | Neutral `EmptyState`, with "Next week" if there is one |
| Failed | `ErrorState` with retry |
| Error on `date` or `start` | Message above the times, announced |

## `/appointments/[id]` (A R)

**Header**: title with the appointment's number and "Back to appointments". No patient detail in the tab title.

**Details**: date, start to end, status, doctor, patient linked through `PatientLink`, phone, note, booked by and at, last rescheduled by and at, last status change by and at, cancellation reason.

**Outside availability**: when true, a notice saying the appointment still stands, the patient isn't told automatically, and it should be moved or cancelled.

**Actions**, by [the offered table](../data-model.md):

| Action | Behaviour |
|---|---|
| Reschedule | Opens a panel in place, with the current date and time visible, `FreeTimes`, "Move", and "Cancel", which closes the panel and returns focus |
| Cancel appointment | `ConfirmDialog`: can't be undone, optional reason, "no medical details" hint |
| No-show | `ConfirmDialog`: can't be undone |

Focus moves to the page's heading after a change or a refusal, because the control pressed may be gone.

| State | Shown |
|---|---|
| Not a valid number, or `404` | `NotFoundState`, with no API call for a bad number |
| `403` | `ForbiddenState` |
| Other failure | `ErrorState` with retry |
| Refused under `appointment` | Message at page level, page refreshed, new state shown |
| `checked_in`, `completed` | Translated status, no actions |

## `/my/appointments` (D)

`FilterBar`: From, To, Status. Columns: Date; Time, linking to the appointment; Patient, with number, name, sex, and date of birth; Status, with the outside-availability label. No phone, no patient link, no actions.

| State | Shown |
|---|---|
| No profile | The gate's existing "profile not set up" state |
| Empty, today | "No appointments today" |
| Empty, filtered | "No appointments match" |
| `422` | On the matching filter |
| Other failure | `ErrorState` with retry |

## `/my/appointments/[id]` (D)

Date, start to end, status, outside-availability label, patient's number, name, sex, and date of birth, note, booked at. No actions. Not a valid number, another doctor's, or none: `NotFoundState`.

## `/patients/[id]` (A R), changed

Adds "Book appointment" (`/appointments/new?patient_id=N`) and "View appointments" (`/appointments?patient_id=N`), whenever a record is shown, including just after registering. Nothing else changes, and no further read happens.

## Field behaviour

Note, reason, and patient search fields use `autoComplete="off"`. Note and reason are never in an address, and appear as written, in their own direction.
