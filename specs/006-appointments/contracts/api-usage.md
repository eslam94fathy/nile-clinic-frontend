# API Usage: Appointments

Verified against `specs/006-appointments/contracts/appointments.openapi.yaml` and source in the backend, at commit `dff2dca`. Confirmed on the running API by `e2e/live/appointments.spec.ts`, as implementation proceeds.

## Operations

| Operation | Read from | Roles | Audit | Success | Failures handled |
|---|---|---|---|---|---|
| `GET /appointments` | Server | A R | None | `200`, page | `401`, `403`, `422` on `from`, `to`, `doctor_id`, `patient_id`, `status`, `outside_availability`, `page` |
| `GET /appointments/{id}` | Server | A R | None | `200` | `401`, `403`, `404` |
| `POST /appointments` | Browser | A R | `appointment.booked` | `201` | `401`, `403`, `409`, `422` |
| `POST /appointments/{id}/reschedule` | Browser | A R | `appointment.rescheduled` | `200` | `401`, `403`, `404`, `409`, `422` |
| `POST /appointments/{id}/cancel` | Browser | A R | `appointment.cancelled` | `200` | `401`, `403`, `404`, `422` |
| `POST /appointments/{id}/no-show` | Browser | A R | `appointment.no_show` | `200` | `401`, `403`, `404`, `422` |
| `GET /doctors/me/appointments` | Server | D | None | `200`, page | `401`, `403`, `404` (no profile), `422` |
| `GET /doctors/me/appointments/{id}` | Server | D | None | `200` | `401`, `403`, `404` |

## Other features' operations used here

| Operation | Read from | Used for | Audit |
|---|---|---|---|
| `GET /doctors/{id}/slots?from&to` | Browser | Free times | None |
| `GET /doctors?is_active=1&name&specialty_id&page` | Browser | Choosing a doctor | None |
| `GET /doctors?per_page=100&page` | Server | The list's doctor filter, every page | None |
| `GET /specialties` | Server | Choosing a doctor | None |
| `GET /patients?name&phone&national_id&id&page` | Browser | Choosing a patient. Never sent with no term | None |
| `GET /patients?id=N` | Browser | Showing a carried or chosen patient | None. **Never `GET /patients/{id}`** |

`GET /patients/{id}` only happens when a person follows a `PatientLink` from an appointment's page, and writes one true `patient.opened`.

## Bodies

```json
POST /appointments
{ "patient_id": 12, "doctor_id": 3, "date": "2026-11-08", "start": "09:20", "note": "First visit" }
```

`note` is left out when empty. `end` is never sent.

```json
POST /appointments/{id}/reschedule
{ "date": "2026-11-10", "start": "10:00" }

POST /appointments/{id}/cancel
{ "reason": "Patient travelling" }
```

`reason` is left out when empty. `no-show` has no body.

## Error keys

| Source | Keys | Where |
|---|---|---|
| Booking | `patient_id`, `doctor_id` | On the chosen patient or doctor |
| Booking, rescheduling | `date`, `start` | On the free times |
| Booking | `note` | On the note |
| Cancelling | `reason` | In the dialog |
| Rescheduling, cancelling, no-show | `appointment` | At page level, and the page refreshes |
| `409` booking or rescheduling | `message` and `reason` only | At form level |
| Anything else | | At form level, never dropped |

`reason` values: `slot_booked`, `patient_busy`. The contract's `already_checked_in` and `patient_with_another_doctor` belong to the queue's operations, not to these.

`slot_unavailable`, `not_changeable`, and `not_started` are translation keys and **aren't sent**, so they're never compared. They're told apart only by the key the message comes under.

## Limits

| Limit | Value | Where it's met |
|---|---|---|
| Listing range | 92 days including both ends | The API's message on `to` |
| Free times per request | 31 days | Always seven |
| Free times, earliest | Clinic's today | `freeTimeWindow` |
| Free times, latest | Today + 90 | `freeTimeWindow` |
| Note | 500 characters | Quick feedback, then the API |
| Reason | 255 characters | Quick feedback, then the API |
| `per_page` | 100 | `readAllDoctors` |
