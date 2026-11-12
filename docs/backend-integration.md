# Backend Integration

What the frontend can rely on from the Nile Clinic API, verified from source rather than assumed.

| | |
|---|---|
| Repository | <https://github.com/eslam94fathy/nile-clinic> |
| Analyzed commit | `dff2dcad0b1bb1484966a20567757d825a9543f8` (2026-11-05) |
| Stack | Laravel 13, Sanctum 4, MySQL, Docker Compose |
| Base URL (local) | `http://localhost:<APP_PORT>/api/v1`. The backend's default is 8080, but this varies by machine, so check with `docker ps` |
| Contracts | `specs/<feature>/contracts/*.openapi.yaml` in the backend repository (11 files) |
| Verification | All **76** route definitions compared with all **76** contract operations: exact match. Policies and sampled API Resources were read directly. Live checks against the running API began in Phase 3 (2026-11-06, at the same commit). Phase 4 exercised every staff, specialty, doctor, scheduling, and fee operation on it, and found no difference from the contracts. |

The backend also ships a Postman collection in `postman/`, with saved error examples.

**Windows note:** the Postman example paths exceed the Windows path limit, so a plain `git clone`
fails at checkout. Use `git clone -c core.longpaths=true <url>`.

## Domain in brief

A single medical center. Staff only: there are no patient accounts and no patient portal in the
backend. The core flow is:

```text
Setup     staff account → doctor profile + specialties → weekly schedule / time off → fee
Booking   patient → free slot → appointment (scheduled)
Arrival   check-in or walk-in → queue entry ("visit") → waiting
Visit     doctor calls next → with_doctor → finish → seen
Record    encounter: draft → finalized → addenda
Money     visit → charge → payments, discount, refunds
Oversight reports, audit trail
```

A **visit** is a queue entry: `visit_id` and the queue entry `id` are the same value.

## Authentication

Sanctum **bearer tokens only**. Sanctum's cookie mode is not enabled (`statefulApi()` is absent), and
sessions are not used (`SESSION_DRIVER=array`).

| Behavior | Detail |
|---|---|
| Sign in | `POST /auth/sign-in` with `{email, password}` returns `data.token` and `data.user`. The token appears only in this response. |
| Use | `Authorization: Bearer <token>` on every other request |
| Expiry | **8 hours with no request.** Each request restarts the timer. There is no refresh endpoint and no absolute maximum. |
| Sign out | `POST /auth/sign-out` ends this token only (`204`) |
| Forced end | Deactivation or an administrator setting a new password ends all the account's tokens. Changing your own password ends the others and keeps the current one. |
| Failures | Wrong password, unknown email, and deactivated account give the same `422`. |
| Limits | Refused for up to 60 s after 5 failures per email, or 20 attempts per client IP, within a minute. Wait time is only inside the message text under `errors.email`; there is no `Retry-After`. |
| Password | 12–72 characters. There is **no forgot-password flow**; an administrator sets a new one. |
| Identity | `GET /auth/me` returns the staff member with their role. A doctor's *doctor id* is a separate value from `GET /doctors/me`. |

## Conventions

**Localization.** Send `Accept-Language: en|ar`; anything else falls back to `en`. Only `message`
texts change. Field names, statuses, and identifiers never do.

**Dates and times** come in three kinds, which must never be mixed:

| Kind | Example | Handling |
|---|---|---|
| Clinic date | `date`, `from`, `to`: `2026-11-08` | Display as sent; never pass through `new Date()` conversion that shifts days |
| Wall-clock time | `start`, `end`: `09:20`; `end` may be `24:00` | Display as sent, with no timezone conversion |
| UTC instant | `*_at` | Format in the clinic's time zone, never the browser's |

Instants have two spellings: Staff uses `2026-11-05T14:22:31+00:00`, others use
`2026-11-05T14:22:31.000000Z`. Parse both; never compare them as strings.

**Money.** EGP, returned as strings such as `"150.00"`; report `net` can be negative. Input accepts
a string or number with at most two decimals. Keep strings; never use floats.

**Lists** come in four shapes:

| Shape | Used by |
|---|---|
| Standard Laravel `data`, `links`, `meta` (`page`, `per_page`, max 100, default 15) | Staff, patients, doctors, appointments, `/queue`, visits, charges, fees, encounter history |
| The same plus top-level `totals` | Reports: billing, activity, times |
| Cursor: `meta.next_cursor`, `prev_cursor`, **no total** | Audit entries only |
| Not paginated: `data` array only | Specialties, slots, time off, `/doctors/{id}/queue`, `/doctors/me/queue` |

The contracts leave `meta` untyped. **Confirmed on the running API** (2026-11-06, commit `dff2dca`, on `/staff`, `/doctors`, `/patients`, `/fees`):
`meta` holds `current_page`, `from`, `last_page`, `links`, `path`, `per_page`, `to`, and `total`, with `total` a number. `from` and `to` are `null`
on an empty page. `per_page` above 100 gives `422`. **No endpoint offers a sort parameter**: order is fixed by the API.

**Page links expose the private address.** `links.*`, `meta.links[].url`, and `meta.path` hold absolute Laravel addresses, repeating the query
string, and `meta.links[].label` is untranslated English. The same-origin route removes them, so the type in `lib/api/pagination.ts` leaves them out.

**Range limits** (the API returns `422` beyond these):

| Endpoint | Limit |
|---|---|
| Slots | Up to 31 days per request, not before today, at most 90 days ahead |
| Appointments, doctor visits, charges | 92 days including both ends; `from` and `to` required |
| Time off list | 366 days |
| Reports | 366 days including both ends |

## Errors

Every error body has a translated `message`. There are **no machine-readable error codes** except the
409 `reason`.

The contracts mention names such as `not_changeable` and `already_charged`. Those are the backend's
**translation keys, not values on the wire** (verified in the exception classes and tests). The client
receives the translated sentence under a field key, for example:

```json
{ "message": "This time is not an available slot for this doctor.",
  "errors": { "start": ["This time is not an available slot for this doctor."] } }
```

So the frontend must not match on message text. It can branch only on status, the `errors` key, and
`reason`.

| Status | Meaning | Frontend behavior |
|---|---|---|
| `401` | Missing, expired, or revoked token, or deactivated account | Clear the session and go to sign-in, returning afterwards |
| `403` | Role not allowed | "Not allowed" state; this also means the role changed or a UI rule is wrong |
| `404` | Not found. For encounters also "not allowed to read", deliberately indistinguishable | Neutral not-found state that does not imply the record exists or not |
| `404` on `/doctors/me*` | Also: this doctor has no profile yet | Dedicated "profile not set up, contact an administrator" state, detected through `GET /doctors/me` |
| `409` | Conflict with `reason` | Show `message`; for slots, refresh the slot list |
| `422` | Validation or business refusal | Map `errors` keys to form fields; show non-field keys at form level |
| `500` | Translated general error. Also returned when an audit entry cannot be saved, in which case **the action did not happen** | Generic error with retry |
| `503` | `GET /health` only: database unreachable | Service-unavailable state |

`409 reason` values: `slot_booked`, `patient_busy`, `already_checked_in`,
`patient_with_another_doctor`.

Non-field `errors` keys seen in the contracts: `appointment`, `entry`, `queue`, `visit`, `encounter`,
`charge`. Removing time off that has ended uses `time_off`. Prescription errors use nested keys such as `prescriptions.0.dosage`.

Schedule errors come under two kinds of key (`SetScheduleRequest`): format rules give `periods.<index>.start`, `.end`, and `.day`, and the
rules between periods give `periods.<index>`. The second only runs when the first finds nothing. The index is the position in the
request, including for overlaps, so send rows in the order shown. The last active administrator's refusal is `message` only, with no `errors`.

## Permission matrix

From the Policy classes. **A** administrator, **R** receptionist, **D** doctor.

| Capability | A | R | D |
|---|---|---|---|
| Own profile, own password, sign out | ✓ | ✓ | ✓ |
| Manage staff accounts | ✓ | | |
| Read specialties and doctors | ✓ | ✓ | ✓ |
| Change specialties and doctor profiles (including a doctor's own) | ✓ | | |
| Read any doctor's schedule, slots, time off | ✓ | ✓ | ✓ |
| Change schedules and time off | ✓ | | |
| Patients: list, search, view, register, update | ✓ | ✓ | **none** |
| Appointments: list, view, book, reschedule, cancel, no-show | ✓ | ✓ | |
| Own appointments, read only (`/doctors/me/appointments`) | | | ✓ |
| Queue: lists, check-in, walk-in, left, undo check-in | ✓ | ✓ | |
| Own queue: list, call next, finish | | | ✓ |
| Medical records | **none** | **none** | ✓ see below |
| Read fees | ✓ | ✓ | |
| Set fees | ✓ | | |
| Visits and charges: read, charge, take payment, cancel | ✓ | ✓ | |
| Discount and refund | ✓ | | |
| Reports | ✓ | | |
| Audit trail | ✓ | | |

Medical record access:

- Doctors read their own records at any time. **Drafts are visible only to their author.**
- Another doctor's **finalized** record is readable only while the patient is on this doctor's list
  today as waiting, with the doctor, or seen.
- History (`/doctors/me/patients/{id}/encounters`) follows the same rule, and is `404` if the patient
  isn't on today's list and this doctor has no finalized records for them.
- Saving, finalizing, and adding addenda are for the author only.

**Consequence:** a doctor's whole view of a patient is `full_name`, `sex`, `date_of_birth`, plus
records. Doctors never see phone, national ID, address, or emergency contact. Administrators, despite
having the broadest role, never see clinical content. These are deliberate rules, not gaps.

## Endpoints

All paths are relative to `/api/v1`. Full fields are in the contracts.

| Module (count) | Endpoints | Contract |
|---|---|---|
| System (1) | `GET /health` (public) | `001` |
| Auth (4) | `POST /auth/sign-in` (public), `POST /auth/sign-out`, `GET /auth/me`, `PUT /auth/password` | `002` |
| Staff (7) | `GET,POST /staff`; `GET,PATCH /staff/{id}`; `POST /staff/{id}/deactivate`, `/reactivate`; `PUT /staff/{id}/password` | `002` |
| Specialties (5) | `GET,POST /specialties`; `PATCH /specialties/{id}`; `POST /specialties/{id}/deactivate`, `/reactivate` | `004` |
| Doctors (5) | `GET,POST /doctors`; `GET /doctors/me`; `GET,PATCH /doctors/{id}` | `004` |
| Patients (4) | `GET,POST /patients`; `GET,PATCH /patients/{id}` | `003` |
| Scheduling (10) | `GET,PUT,DELETE /doctors/{id}/schedule`; `GET /doctors/{id}/slots`; `GET,POST /doctors/{id}/time-off`; `DELETE /doctors/{id}/time-off/{timeOff}`; `GET /doctors/me/schedule`, `/slots`, `/time-off` | `005` |
| Appointments (8) | `GET,POST /appointments`; `GET /appointments/{id}`; `POST /appointments/{id}/reschedule`, `/cancel`, `/no-show`; `GET /doctors/me/appointments`, `/{id}` | `006` |
| Queues (9) | `POST /appointments/{id}/check-in`; `GET /queue`; `POST /queue/walk-ins`; `POST /queue/{entry}/leave`; `DELETE /queue/{entry}`; `GET /doctors/{id}/queue`; `GET /doctors/me/queue`; `POST /doctors/me/queue/call-next`, `/finish` | `007` |
| Encounters (7) | `GET /doctors/me/visits`; `POST /doctors/me/visits/{visit}/encounter`; `GET,PUT /doctors/me/encounters/{id}`; `POST /doctors/me/encounters/{id}/finalize`, `/addenda`; `GET /doctors/me/patients/{id}/encounters` | `008` |
| Payments (11) | `GET /fees`; `GET,PUT /doctors/{id}/fee`; `GET /visits`; `POST /visits/{visit}/charge`; `GET /charges`; `GET /charges/{id}`; `POST /charges/{id}/payments`, `/refunds`, `/cancel`; `PUT /charges/{id}/discount` | `009` |
| Reports (4) | `GET /reports/money-collected`, `/billing`, `/activity`, `/times` | `010` |
| Audit (1) | `GET /audit-entries` | `011` |

Enumerations:

| Field | Values |
|---|---|
| Role | `administrator`, `receptionist`, `doctor` |
| Sex | `male`, `female` |
| Appointment status | `scheduled`, `cancelled`, `no_show`, `checked_in`, `completed` |
| Queue status | `waiting`, `with_doctor`, `seen`, `left` |
| Record status | `none`, `draft`, `finalized` |
| Charge status | `unpaid`, `partially_paid`, `paid`, `cancelled` (visit lists use `none`, not `cancelled`) |
| Payment method | `cash`, `card`, `wallet` |
| Day | `sunday` … `saturday` |
| Audit outcome | `succeeded`, `refused` |
| Audit subject | `staff_member`, `patient`, `specialty`, `doctor`, `time_off`, `appointment`, `visit`, `encounter`, `charge` |
| Audit action | 44 values; see contract `011` |

## Business rules the UI must respect

The API enforces all of these. The UI only needs to present them well.

**Appointments.** A booking must start on a currently offered slot. Rescheduling stays with the same
doctor; there is no reassignment. Only `scheduled` appointments can be changed, and no-show requires a
passed start. `outside_availability: true` flags upcoming appointments that reception should move
after a schedule change, because schedule changes are never blocked by appointments.

**Queue.** Queues are always for the clinic's today; there is no date parameter. Numbers are never
reused. Only a waiting entry that came from an appointment can be undone, and not while it has an
active charge. Walk-ins take no slot. `/queue` has no doctor filter; use `/doctors/{id}/queue`. Calling
next may skip someone who is with another doctor, and there is no way to send a called patient back.

**Encounters.** `PUT` replaces the whole draft and requires every key. Finalizing needs
`chief_complaint`, `diagnosis`, and each prescription's `dosage`, `frequency`, and `duration`, and it
is irreversible. Afterwards only addenda are possible, and those are permanent too. Finishing a visit
does not require a record.

**Payments.** A charge uses the fee at that moment. One active charge per visit, and several payments
up to the balance. Payments and refunds are permanent. Cancelling needs a reason and no money held;
the visit can then be charged again.

**Schedules.** An empty `periods` is valid, and leaves `appointment_minutes` set, so a length alone doesn't mean there are hours.

**Fees.** Above 0 and at most 100000. A fee can't be zero, and can't be removed once set.

**Staff.** An administrator may deactivate or demote themselves, unless they're the last active one. Setting a password from the staff
routes ends all that account's tokens, including the caller's own, so the application sends people to their account page instead.

**Doctors.** Specialties are deactivated, never deleted; assigned ones stay. Specialties carry both
`name_en` and `name_ar`, so pick by locale. A doctor counts as active only while the account is active
with the doctor role.

**Patients.** Never deleted. Lists contain five fields only; sensitive fields come only from opening
one patient. Send `null` to clear an optional field.

Confirmed on the running API (2026-11-06, commit `dff2dca`, by `e2e/live/patients.spec.ts`):

- `name` matches part of a name across alef, taa marbuta, and yaa spellings. The frontend sends it as typed.
- `phone` is normalised before matching, and matching is exact, so patients sharing a phone are all listed. A malformed `phone` or `national_id` filter is `422` on that key, not an empty result.
- `POST` writes `patient.registered`, and no `patient.opened`. A `PATCH` that changes something writes `patient.updated`, and no `patient.opened`.
- A body with every field invalid is `422` under `full_name`, `date_of_birth`, `sex`, `phone`, `national_id`, `address`, and `emergency_contact.name`, `.relationship`, and `.phone`.
- A repeated `national_id` is `422` on that key, on `POST` and on `PATCH`.

From the source only, not exercised, because the frontend never does these (`PatientService`, `ListPatientsRequest`, `UpdatePatientRequest`):

- **A `PATCH` that changes nothing writes `patient.opened`**, so that sending one known field can't read the rest without a trace. The form compares after normalising, and sends nothing.
- `full_name` has its inner spaces collapsed when stored (`ArabicName::clean`), so a difference only in those is a `PATCH` that changes nothing.
- An empty `PATCH` is `422` under the key `fields`.
- **`GET /patients` with no filters lists everyone,** so the frontend never sends it with no term.

**Appointments, confirmed on the running API** (2026-11-07, commit `dff2dca`, by `e2e/live/appointments.spec.ts`):

- List rows hold exactly `id`, `date`, `start`, `end`, `status`, `outside_availability`, `doctor`, and `patient`, with the patient as `id`, `full_name`, and `phone`.
- Reading a list or an appointment writes no audit entry, for staff or doctors. Booking, rescheduling, cancelling, and no-show each write one entry of their own, and no `patient.opened`.
- `GET /patients?id=N` writes no `patient.opened`, so it's the way to show a patient without opening them.
- Two simultaneous bookings of one time give one `201` and one `409` `slot_booked`.
- A time not on offer is `422` under `start`. A range over 92 days is `422` under `to`. A no-show before the start is `422` under `appointment`. A cancellation after the start is refused too, and nothing changes.
- Time off covering a booking sets `outside_availability`, and the `outside_availability=1` filter finds it. Rescheduling clears both.
- Cancelling frees the time, and returns a reason exactly as written, including in Arabic.
- Free times leave out the doctor's bookings, but not the patient's, so a time can be offered and still be refused with `409` `patient_busy`.
- A doctor gets `403` on every `/appointments` route, sees no phone in their own, and gets `404` for another doctor's.

From the source only, not exercised: `422` under `date`, `patient_id`, `doctor_id`, and `note` when booking, and under `reason` when cancelling. The fake backend covers how each appears.

**Queue, confirmed on the running API** (2026-11-07, commit `dff2dca`, by `e2e/live/queue.spec.ts`):

- Rows hold exactly `id`, `queue_number`, `status`, `arrived_at`, `called_at`, `finished_at`, `left_at`, `walk_in`, `appointment`, `doctor`, and `patient`, with the patient as `id`, `full_name`, and `phone`. A doctor's own rows have no `doctor`, and their patient is `id`, `full_name`, `sex`, and `date_of_birth`, with no phone.
- Reading a list writes no audit entry, including over four real 15-second intervals. Check-in, walk-in, left, undo, call next, and finish each write one entry of their own (`visit.checked_in`, `visit.walk_in_added`, `visit.left`, `visit.check_in_undone`, `visit.called`, `visit.finished`), and no `patient.opened`.
- A second check-in is `422` under `appointment`, as is a check-in on another day. Of two at once, one is `201`, the other is `409` or `422`, and there's one row. The test accepts either, so which one comes back isn't established.
- A walk-in for someone already on the list is `422` under `patient_id`. A walk-in takes no free time.
- Left or undo on someone no longer waiting is `422` under `entry`. Left keeps the row, and that patient is never called.
- Undo removes the row and returns the appointment to `scheduled`. Checking in again gives a higher number.
- Call next with nobody waiting, or with a patient already with the doctor, is `422`, and with nobody waiting it's under `queue`. Finish with nobody current is `422`. Finishing completes the appointment.
- A doctor gets `403` on `/queue`, `/doctors/{id}/queue`, walk-ins, left, and undo. A receptionist gets `403` on `/doctors/me/queue`, call next, and finish.
- Filtering by a doctor who doesn't exist shows the not-found state. The test checks the page, not the status.
- Two signed-in browsers each showed the other's change within 20 seconds, with no interaction.

From the source only, not exercised: `409` `patient_with_another_doctor`, `409` `already_checked_in`, the walk-in's `409`, undo refused for an active charge, and a walk-in's `422` under `doctor_id`. The fake backend covers how each appears.

**Medical records, confirmed on the running API** (2026-11-07, commit `dff2dca`, by `e2e/live/encounters.spec.ts`):

- `GET /doctors/me/visits` holds no clinical content and writes no entry. Its rows give `encounter_id` and `record_status`.
- Starting, saving a change, finalizing, and adding an addendum each write one entry of their own (`encounter.started`, `encounter.draft_saved`, `encounter.finalized`, `encounter.addendum_added`), and no `encounter.opened`. An identical `PUT` writes nothing.
- `GET` of a record writes one `encounter.opened`, and of a history one `encounter.history_viewed`. Audit entries hold no clinical text.
- A refused read of a record that exists writes `encounter.opened` with outcome `refused`, and of a history only if the patient has a finalized record. Reading a history for a patient with none writes nothing.
- Each clinical field keeps 10,000 characters, with 20 lines of 500 characters each. Arabic and line breaks come back as written. Spaces at the ends are trimmed, and empty text becomes `null`.
- Administrators and receptionists get `403` on all seven operations. Another doctor's draft gives a `404` with a body identical to an unknown id's.
- Another doctor's finalized record reads only while the patient is on this doctor's list today, and stops once they're marked as left. Changing it, or adding to it, is `403`.
- Finalizing an incomplete record is `422`, naming every missing field at once, with lines numbered as sent, such as `prescriptions.0.dosage`. Saving over a finalized record is `422` under `encounter`. A save missing a key is `422`, and a draft refuses an addendum with `422`.

**Payments, confirmed on the running API** (2026-11-08, commit `dff2dca`, by `e2e/live/billing.spec.ts`):

- Opening and reloading Billing, Charges, and a charge writes no audit entry of any kind, and showing a patient there writes no
  `patient.opened`.
- Charging writes one `charge.created`, at the doctor's fee. Each payment writes one `payment.recorded`; a discount one
  `discount.set`, leaving the fee; a refund one `refund.recorded`, leaving the payment; and cancelling one `charge.cancelled`, after
  which the visit can be charged again.
- Undoing the check-in of a visit with an active charge is `422`, and the queue's dialog shows the API's message.
- A receptionist's refund is `403`, and writes no entry.
- The patient's name and phone and the amounts typed stayed out of every address visited, and a refund's reason and the patient's
  name out of browser storage and the application server's log.

**Reports, confirmed on the running API** (2026-11-10, commit `dff2dca`, by `e2e/live/reports.spec.ts`):

- Opening all four reports, for the clinic and for one doctor, writes no audit entry of any kind.
- Every figure the app shows matched the API's own for the same query: Money collected's totals for one doctor, every Billing
  total, Activity's new patients, booked and walk-in visits and no-show rate, and Times' average wait.
- With `doctor_id`, Activity leaves `totals.new_patients` out rather than sending zero.
- A receptionist and a doctor are refused every report.
- Not exercised live: a no-show, a seen visit never charged, and a range refusal, which the app never sends (it checks the period
  first).

**Payments, from the source** (`app/Modules/Payments`), not exercised beyond the above:

- No read writes an audit entry: `GET /visits`, `GET /charges`, and `GET /charges/{id}`. Each change writes one entry of its own
  (`charge.created`, `payment.recorded`, `refund.recorded`, `discount.set`, `charge.cancelled`). A discount writes one even when it
  repeats the last. Refusals write none.
- Every change locks its row first, so a payment above the balance, a refund above what was paid, and a second active charge are
  impossible even when two arrive at once. There's no idempotency key: see hazard H6.
- Refusals are `422` under `visit` (left, already charged, no fee), `amount` (above the balance, above what was paid, discount too
  large), and `charge` (cancelled, money held), plus field keys `amount`, `method`, and `reason`. A charge range over 92 days is
  `422` under `to`, shared with appointments.
- `GET /visits` orders by doctor, then queue order, and lists a visit marked as left only while it has an active charge.

**"No medical details" fields.** The API asks that time-off reason, appointment note, and charge
reasons hold no medical details. Time-off reasons are readable by all staff. These fields need a
visible hint.

## Integration hazards

Found during analysis. Each one affects the design.

### H1. Reads leave audit entries

Each successful `GET /patients/{id}` (`patient.opened`), `GET /doctors/me/encounters/{id}`
(`encounter.opened`), `GET /doctors/me/patients/{id}/encounters` (`encounter.history_viewed`), and
`GET /audit-entries` (`audit.searched`, for every page) writes a permanent audit entry. Refused record
openings are recorded too.

TanStack Query's default refetch on focus, a retry, or a prefetched link would therefore write false
"opened" entries to a permanent record. See [ADR 0005](decisions/0005-audit-safe-data-fetching.md).
A read on the server would too, after a refresh and the back button, so patient records are read in the
browser. See [ADR 0012](decisions/0012-audited-reads-in-the-browser.md), which Phases 8 and 11 should start from.

A `PUT` that changes a draft also writes `encounter.draft_saved`, and an identical one writes nothing, as confirmed on the running API,
so timer-based autosave would flood the trail. Drafts save only when a doctor chooses to ([ADR 0014](decisions/0014-writing-medical-records.md)).

### H2. A server-side proxy hides the real client IP

The backend uses `request()->ip()` for the audit trail's `network_address` and the sign-in limit, and
**trusted proxies are not configured**. If requests go through the Next.js server, then:

- every audit entry records the Next.js server's address, and
- all staff share one limit of 20 sign-in attempts per minute, so one person can lock out the clinic.

Fixing it requires a backend configuration change. See
[ADR 0001](decisions/0001-authentication-bff.md). **The frontend's part is done** (Phase 13): `callBackend` passes the incoming
`X-Forwarded-For` on unchanged, and the reverse proxy replaces it with the connecting address ([ADR 0022](decisions/0022-deployment.md)).
The backend's part is [request B1](../specs/013-hardening/backend-requests.md): trusting the frontend container's address.

### H3. Polling can defeat the idle timeout

There is no real-time channel (no broadcasting or websockets in the backend), so queue screens must
poll. Each request restarts the 8-hour idle timer, so a visible queue screen on an unattended computer
stays signed in indefinitely. Decision Q2 in the [roadmap](roadmap.md) accepts this: polling only runs
on visible tabs, and there is no inactivity sign-out. Clinical pages are the exception since Phase 13: the record and history pages
lock after 5 minutes without activity, whatever polling elsewhere does ([ADR 0020](decisions/0020-inactivity-lock.md)).

### H4. The clinic time zone is not exposed

`CLINIC_TIMEZONE` is backend configuration (default `Africa/Cairo`) and no endpoint returns it. The
frontend needs its own copy to display instants and compute today's default dates. The two must be
kept in step, which is a deployment concern.

### H5. Joining data for the doctor's workspace

Queue entries have no `encounter_id`, and `/doctors/me/visits` excludes waiting patients. Showing a
current visit's record status means joining `/doctors/me/queue` with `/doctors/me/visits?from=today&to=today`
by id, which "My queue" does, as `encounter_id` and `record_status` come from visits. `POST .../encounter` on a started visit returns
`422` with no id, so the list is read again for it.

### H6. A money action has no idempotency key

`POST /charges/{id}/payments`, `/refunds`, `/cancel`, `PUT /charges/{id}/discount`, and `POST /visits/{id}/charge` take no key
that would let the API recognise a repeat. A payment sent twice that fits the balance is recorded twice, and payments can't be
edited, so only an administrator's refund can correct it. So the frontend sends each action once: one request at a time, never
retried, and when no usable answer arrives (`isOutcomeUnknown`), it reads the charge again and asks the person to check the payments
before trying again, rather than resending ([research R4](../specs/009-billing-payments/research.md)).

## Backend gaps

Workable today, but worth knowing. Nothing has been changed in the backend.

| # | Gap | Effect | Current approach |
|---|---|---|---|
| G1 | `/staff` has no name search | Finding a staff member in a long list | Filter by role and status, then page |
| G2 | Nothing links a staff account to a doctor profile: `DoctorSummary` omits `user_id`, and `/staff` has no "has profile" filter | The create-doctor screen can't exclude accounts that already have a profile, and staff pages can't link to the doctor | A paged table of doctor-role accounts, then the form; the API's `422` on `user_id` decides. A new doctor-role account goes straight to its form, the one time its id is known |
| G3 | No dashboard or summary endpoint | Dashboards need several calls (18 across the three roles); receptionists and doctors have no reports | Compose from existing lists, counting with `meta.total` on a one-row page ([ADR 0019](decisions/0019-dashboards-read-in-panels.md)). **Confirmed on the running API** (2026-11-11, commit `dff2dca`, by `e2e/live/dashboard.spec.ts`): each figure equals the API's own total for the same filter, and opening, refreshing, and leaving a dashboard open for two intervals writes no audit entry |
| G4 | No sort parameters | No sortable columns anywhere | Don't offer sorting; sorting one client page would mislead |
| G5 | Throttle wait is only in message text | No countdown possible without parsing | Show the message as sent |
| G6 | No clinic details endpoint | Clinic name and logo have no source | Held in the frontend ([ADR 0009](decisions/0009-brand-assets.md)) |
| G7 | No receipt or print endpoint | No printed receipts or prescriptions | Out of scope: decision Q5 in the [roadmap](roadmap.md) |
| G8 | Queue routes only reach the clinic's today (from the source) | An entry still waiting or with a doctor at midnight can't be reached or closed afterwards, so it stays open | Nothing in the frontend can fix it. The screens show today only |
| G9 | Saving a draft has no version check, and finalizing takes no content (confirmed on the running API) | With two tabs on one draft, the last save wins with no warning, and finalizing locks what was last saved, which may be the other tab's | The page says so after finalizing, if what was locked differs from what was on screen. It can't warn before. Raised with the backend as [request B2](../specs/013-hardening/backend-requests.md) |
