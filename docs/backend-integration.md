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

Every `PUT` of a draft also writes `encounter.draft_saved`, so timer-based autosave would flood the
trail. To be decided in the encounters spec.

### H2. A server-side proxy hides the real client IP

The backend uses `request()->ip()` for the audit trail's `network_address` and the sign-in limit, and
**trusted proxies are not configured**. If requests go through the Next.js server, then:

- every audit entry records the Next.js server's address, and
- all staff share one limit of 20 sign-in attempts per minute, so one person can lock out the clinic.

Fixing it requires a backend configuration change. See
[ADR 0001](decisions/0001-authentication-bff.md).

### H3. Polling can defeat the idle timeout

There is no real-time channel (no broadcasting or websockets in the backend), so queue screens must
poll. Each request restarts the 8-hour idle timer, so a visible queue screen on an unattended computer
stays signed in indefinitely. Decision Q2 in the [roadmap](roadmap.md) accepts this: polling only runs
on visible tabs, and there is no inactivity sign-out.

### H4. The clinic time zone is not exposed

`CLINIC_TIMEZONE` is backend configuration (default `Africa/Cairo`) and no endpoint returns it. The
frontend needs its own copy to display instants and compute today's default dates. The two must be
kept in step, which is a deployment concern.

### H5. Joining data for the doctor's workspace

Queue entries have no `encounter_id`, and `/doctors/me/visits` excludes waiting patients. Showing a
current visit's record status means joining `/doctors/me/queue` with `/doctors/me/visits?from=today&to=today`
by id. `POST .../encounter` on a started visit returns `422` with no id, so look the id up from visits.

## Backend gaps

Workable today, but worth knowing. Nothing has been changed in the backend.

| # | Gap | Effect | Current approach |
|---|---|---|---|
| G1 | `/staff` has no name search | Finding a staff member in a long list | Filter by role and status, then page |
| G2 | Nothing links a staff account to a doctor profile: `DoctorSummary` omits `user_id`, and `/staff` has no "has profile" filter | The create-doctor screen can't exclude accounts that already have a profile, and staff pages can't link to the doctor | A paged table of doctor-role accounts, then the form; the API's `422` on `user_id` decides. A new doctor-role account goes straight to its form, the one time its id is known |
| G3 | No dashboard or summary endpoint | Dashboards need several calls; receptionists and doctors have no reports | Compose from existing lists, showing only what they return |
| G4 | No sort parameters | No sortable columns anywhere | Don't offer sorting; sorting one client page would mislead |
| G5 | Throttle wait is only in message text | No countdown possible without parsing | Show the message as sent |
| G6 | No clinic details endpoint | Clinic name and logo have no source | Held in the frontend ([ADR 0009](decisions/0009-brand-assets.md)) |
| G7 | No receipt or print endpoint | No printed receipts or prescriptions | Out of scope: decision Q5 in the [roadmap](roadmap.md) |
