# Screens: Queue

Each uses the shared design system, in both languages and directions. Page access comes from the single role map, and `ScreenGate` decides before any read.

## `/queue` (A, R)

Header: title, description, "Add walk-in", and "Today's appointments", which leads to where check-in happens. Below it: the doctor and status filters, and the last-read line.

| State | Shows |
|---|---|
| Loading | The shared loading state, on the first read or a changed filter |
| Success | One table per doctor, with the doctor's name above it, and paging when the API has more |
| Empty, no filters | "Nobody has arrived today", with today's appointments and adding a walk-in |
| Empty, filters | "Nobody matches", keeping the filters, with today's appointments and adding a walk-in |
| First read failed | The error state, with "Try again" |
| Refresh failed | The list stays, with "This may be out of date" and the last-read time |
| `403` | "Not allowed". Patient details removed, and reading stops |
| `404`, doctor | Neutral not-found, with a link to all doctors. Reading stops |
| `401` | The usual sign-in redirect |
| Doctors for the filter failed | The list works. The doctor filter says the doctors couldn't be read, and keeps any doctor already chosen, as Appointments does |

**Row**: number; status; arrived; appointment's start and end, linking to it, or "Walk-in"; called, finished, or left where they exist; patient number, name as a link to their record, and phone; and any action.

**Actions**: `waiting` offers "Mark as left", and "Undo check-in" if it came from an appointment. Any other status offers nothing.

**Dialogs**:

| Dialog | Says |
|---|---|
| Mark as left | Names the patient. Can't be undone |
| Undo check-in | Names the patient. Their appointment returns to scheduled, and their number isn't reused |

On a refusal, the dialog stays open with the API's message, and the list is read again underneath. On closing, focus returns to the row's button, or the heading if it's gone.

## `/queue/walk-in` (A, R)

Steps, in order: patient (`PatientChooser`, or `ChosenPatient` when carried), then doctor (`DoctorChooser`, active only), then a note that a walk-in can't be removed, only marked as left, and "Add to queue". A link returns to the Queue page.

| State | Shows |
|---|---|
| Specialties failed | `ApiFailureState` |
| No patient found | The chooser's empty state, with a link to register |
| `patient_id` not valid or not found | "No patient was found", with the search |
| Submitting | The button shows progress, and can't be pressed again |
| Success | A confirmation with the queue number, then `/queue`. The form is empty when next opened |
| `422` | On the patient or doctor, with choices kept |
| Anything else | At form level |
| Outcome unknown | "Can't tell whether this was saved", with a link to the Queue page. Trying again is safe while the patient is on the list, as the API refuses |

## `/my/queue` (D)

Header: title and description. Below it: the current patient, the action, the last-read line, and the list.

| State | Shows |
|---|---|
| Loading | The shared loading state |
| Patient with the doctor | A distinct "Current patient" panel with their name, number, sex, date of birth, and times, and "Finish visit" |
| Nobody with the doctor, someone waiting | "Call next" |
| Nobody with the doctor, nobody waiting | "Nobody is waiting", with the list of those seen or left, if any. Reading continues |
| Nobody at all | "Nobody has arrived today". Reading continues |
| First read failed | The error state, with "Try again" |
| Refresh failed | The list stays, with the notice |
| No profile | The existing "profile not set up" state, from the gate |
| `403` | "Not allowed". Patient details removed, and reading stops |

**Row**: number; status; arrived; appointment's start and end, or "Walk-in"; called and finished where they exist; patient number, name, sex, and date of birth. No links, and no actions.

**Dialogs**:

| Dialog | Says |
|---|---|
| Call next | The next patient in the queue will be called. A called patient can't be sent back. Names nobody |
| Finish visit | Names the current patient. Can't be undone. Doesn't mention a medical record |

On success, a confirmation names the patient the API returned. On a refusal, the dialog stays open with the API's message, and the list is read again. The dialog opens on the safe choice.

## `/appointments/[id]`, changed (A, R)

| Appointment | Change |
|---|---|
| `scheduled`, dated today | Gains "Check in", first among the actions, with no confirmation |
| `scheduled`, another date | No change |
| `checked_in` | Gains a link to that doctor's list |
| Anything else | No change |

After check-in, a confirmation gives the queue number, and the page shows the new state. On a refusal, the API's message appears at page level, and the page shows the current state. If the outcome is unknown, it says so, and the page refreshes.

## `/patients/[id]`, changed (A, R)

Gains a third link, "Add to today's queue", to `/queue/walk-in?patient_id=N`, with `prefetch={false}`. It shows nothing about the queue.

## Permissions

| Screen or action | A | R | D |
|---|---|---|---|
| `/queue`, `/queue/walk-in` | ✓ | ✓ | Not allowed, with no read |
| Check in, walk-in, left, undo | ✓ | ✓ | `403` if forced |
| `/my/queue` | Not allowed | Not allowed | ✓ |
| Call next, finish | `403` if forced | `403` if forced | ✓ |
