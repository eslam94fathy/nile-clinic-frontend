# Research: Appointments

Findings come from the backend's source and contracts at the analyzed commit `dff2dca`, and from this repository's code. Nothing here has run against the live API yet. The live suite confirms each of these during implementation ([quickstart.md](quickstart.md)), and `docs/backend-integration.md` records only what's observed.

## R1. Reading appointments: on the server, as ADR 0011 says

**Decision**: Lists and appointment pages read in Server Components through `serverApi`. Changes go through `browserApi`, then `router.refresh()`.

**Rationale**: `AppointmentController` and `OwnAppointmentController` write no audit entry on `index` or `show`. Only booking, rescheduling, cancelling, and no-show do, inside `BookingService` and `AppointmentService`. So ADR 0012's reason for reading in the browser doesn't apply, and ADR 0011's tested refresh is exactly what keeps held lists current (FR-022).

**Alternatives**: Browser reads, like patients: more code and no benefit, since nothing is audited. TanStack Query: stays uninstalled until Phase 7's polling.

**Spec change this caused**: FR-022 and the matching scenarios said "no further read", carried over from patients. They now require the new state to show, and allow reading again.

## R2. Choosing a patient without writing an opening

**Decision**: Choosing uses the list read `GET /patients`. A patient carried by number uses `GET /patients?id=N`, and never `GET /patients/{id}`. Both run in the browser.

**Rationale**: `ListPatientsRequest` accepts `id`, and only the single read writes `patient.opened`. The list gives number, name, sex, date of birth, and phone, which is all these screens show (FR-003). ADR 0012 keeps every patient API call in the browser, and this follows it, so `features/patients/api/patients.ts` stays browser-only.

An empty list means no such patient. A value that can't be a number never reaches the API (`readPositiveId`).

**Note**: `GET /appointments?patient_id=N` runs on the server. It isn't a read of a patient, and isn't audited, so this doesn't conflict with ADR 0012.

## R3. Sharing patient search with the chooser

**Decision**: Extract the search's reading logic from `PatientSearch` into a hook inside `features/patients`, used by `PatientSearch` and a new `PatientChooser`, which `public.ts` exports.

**Rationale**: FR-002 requires the same rules, and the logic is subtle: request ordering, falling back from a page that no longer exists, and `403` clearing the terms. Two real consumers meet Principle IX. `PatientSearch`'s tests must keep passing unchanged, which proves the extraction changed nothing.

**Alternatives**: A second copy would drift. Reusing `PatientSearch` with a prop would put choosing and linking in one component, and a row that links to a record is what a chooser must never do.

## R4. Choosing a doctor

**Decision**: `DoctorChooser` in `features/doctors`, reading `GET /doctors?is_active=1` in the browser, with a name field and a specialty select, and API paging. Specialties are read once on the server by the page and passed in.

**Rationale**: FR-004 needs finding by name. The API's name matching handles Arabic variants, so filtering a loaded list in the browser would re-implement a backend rule (Principle I). Results change without a page navigation, and what's being booked is held in client state, so a browser read is the natural fit. Doctors aren't private or audited.

**The list's doctor filter is different**: a native select in `FilterBar`, because the filter must live in the address (FR-012). It needs every doctor, including inactive ones (FR-013), so a new `readAllDoctors` reads `per_page=100` on the server and follows `last_page`.

## R5. Free times

**Decision**: A `FreeTimes` component in `features/scheduling`, exported through a new `public.ts`, reading `GET /doctors/{id}/slots` in the browser.

| Detail | Rule | Source |
|---|---|---|
| Window | `from` to `min(from + 6, today + 90)`, always one request | `ListSlotsRequest`: at most 31 days, `from` not before today, `to` not beyond 90 days |
| Earlier week | Offered only when `from` is after today, and never goes before today | Same |
| Later week | Offered only when `to` is before today + 90 | Same |
| Grouping | By the `date` the API sends, in its order. Days with no free time are left out, and if all seven have none, the empty state appears | Contract: date and time order |
| Empty | Neutral wording, as an inactive doctor, no schedule, and a full week look the same | Contract: `listSlots` description |
| Selection | Native radio inputs, one group, each named with its date and time | FR-037 |

**Rationale**: Radios give keyboard operation and an announced name without new behaviour. Reading is triggered only by choosing a doctor, changing the window, the refresh button, or a parent's signal after a refusal (FR-006). The newest request wins, as in `PatientSearch`.

`today` comes from the page, using `clinicToday`. If it's out of date around midnight, the API refuses, and its message appears (H4).

## R6. What a refusal does

From `BookingService` and `AppointmentService`, for both booking and rescheduling:

| Answer | Key | Screen |
|---|---|---|
| `409`, reason `slot_booked` | `message` only | Message at form level, free times read again, time cleared |
| `409`, reason `patient_busy` | `message` only | The same, plus a link to the patient's appointments on that date |
| `422` | `start`, including a date outside today to 90 days | On the free times, read again, time cleared |
| `422` | `date` | On the free times |
| `422` | `patient_id`, `doctor_id`, `note` | On that part of the form |
| `422` | `appointment` (`not_changeable`, `not_started`) | At page level, and the page refreshes |
| `404` | Appointment | `useFormSubmit` already refreshes, and the page shows not-found |
| `403` | | Refreshes, and the gate decides |

Only status, key, and `reason` are compared, never text. `useFormSubmit` hides the error from its caller, so it gains an optional `onFailure(error)`. Existing callers are unaffected.

**An unknown outcome**: the same-origin route answers `502` when the backend gives no usable response, and `browserApi` gives status `0` when no response arrives. For a change, those mean it may have been saved, unlike a `500`, which the API defines as "the action did not happen". `isOutcomeUnknown(error)` is `status === 0 || status >= 502`. Booking then says it can't tell, and links to the patient's appointments. Submitting again is safe, because a saved booking makes the API refuse with a conflict. Mutations are never retried automatically.

## R7. Which actions are offered

**Decision**: `offeredActions(status, date, start, clinicNow)`, a pure function. Scheduled and not started: reschedule and cancel. Scheduled and started: no-show. Anything else: none. Started means `"{date} {start}" <= clinicNow`, comparing strings in the clinic's zone, the same comparison as the backend's `Appointment::hasStarted`.

**Rationale**: This only decides what's shown, and the API's refusal wins (FR-021). It's quick feedback, as Principle I allows. Offering every action always would make a person try something certain to fail. `clinicNow` is a new sibling of `clinicToday` in `lib/format`, and is worked out on the server when the page renders. An old page can offer something no longer possible, and the refusal then refreshes it (spec, edge cases).

## R8. Dialogs, and a button that disappears

**Decision**: `AppointmentActions` holds a page-level refusal. A small `ConfirmedChange` in the feature serves cancel and no-show, using `ConfirmDialog`, which gains an optional `children` slot for the reason field.

**Rationale**: `ConfirmedAction` keeps its dialog open with the message on any refusal. Here, a `not_changeable` refusal triggers a refresh that removes the button, and the dialog and its message with it. So a refusal under `appointment` closes the dialog, moves the message to page level, and refreshes. A refusal under `reason` stays in the dialog, on its field. After a success or a refusal, focus moves to the page's heading, because the trigger may no longer exist.

**Alternatives**: Extending `ConfirmedAction` with these rules adds options that only this feature uses (Principle IX).

## R9. Return after sign-in (FR-031)

**Finding**: Already met. `proxy.ts` clears the query and passes only the path to `safeReturnAddress`, which also strips any query it's given. Appointment paths aren't in `opensAuditedRecord`, because they're not audited, so someone can return to `/appointments/5`. A unit test pins this for appointment addresses with `patient_id`.

## R10. A live appointment whose start has passed

**Problem**: The API refuses a booking in the past, so a no-show needs real time to pass.

**Decision**: The live test waits for it. Using a dedicated synthetic doctor, it sets 5-minute appointments for today, in a period starting at the next 5-minute boundary at least one minute away, books that slot, waits for its start to pass, then marks the no-show through the page. This takes at most about six minutes, in one test with its own timeout. The test skips itself, saying why, within the last few minutes of the clinic's day, when no such period exists. A skip is reported as a skip.

**Rationale**: It uses only the public API, and proves the real rule, including refusal before the start. `5` is the API's smallest length (`SetScheduleRequest`).

**Alternatives**: Editing the appointment's row through `artisan tinker` in the container: faster, but it ties the tests to a container name and the database's shape, and tests an appointment that couldn't have come about through the API. Faking the time: not possible without changing the backend. The fake backend covers no-show states quickly in the normal suite.

## R11. Default ranges and `FilterBar`

**Decision**: A pure `resolveRange(query, today)`. With `from` or `to` in the address, those are used. Otherwise, with `patient_id` or `outside_availability`, today to today + 90. Otherwise, today only.

Today + 90 covers everything upcoming: bookings can't be made further ahead, and it's 91 days including both ends, within the limit of 92.

`FilterBar` gains an optional per-filter `defaultValue`, shown when the address has none, restored on reset, and included in its sync key, because the default changes with other filters. A date field left empty while a range is applied would misstate what's on screen.

"Needing a move" isn't a `FilterBar` field. It's two links, "All" and "Needing a move", that drop `from`, `to`, and `page`. As a field, applying it would write the displayed one-day range into the address and lose the 90 days. Keeping it as links also makes FR-014 true by construction, as nothing can send `outside_availability=false`. The patient filter likewise sits outside the bar, because its terms must stay out of the address.

## R12. Nothing new to install

No dependency is added: `react-hook-form`, `zod`, and `sonner` already cover this. TanStack Query waits for Phase 7, as ADR 0011 says.
