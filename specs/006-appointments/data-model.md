# Data Model: Appointments

The API owns all of this. Nothing is stored by the frontend. Types derive from `lib/api/generated/appointments`, and response schemas use `satisfies z.ZodType<Generated>`.

## Appointment

| Field | Kind | List | Page | Doctor's list | Doctor's page | Display |
|---|---|---|---|---|---|---|
| `id` | Number | ✓ | ✓ | ✓ | ✓ | As sent, left to right |
| `date` | Clinic date | ✓ | ✓ | ✓ | ✓ | As sent |
| `start` | Wall clock | ✓ | ✓ | ✓ | ✓ | As sent |
| `end` | Wall clock, may be `24:00` | ✓ | ✓ | ✓ | ✓ | As sent |
| `status` | Enum | ✓ | ✓ | ✓ | ✓ | `StatusBadge`, kind `appointment` |
| `outside_availability` | Boolean | ✓ | ✓ | ✓ | ✓ | A text label when true |
| `doctor` | `id`, `name`, `title` | ✓ | ✓ | | | Stored text, as written |
| `patient`, staff view | `id`, `full_name`, `phone` | ✓ | ✓ | | | Name as written; phone left to right |
| `patient`, doctor view | `id`, `full_name`, `sex`, `date_of_birth` | | | ✓ | ✓ | Sex translated; date as sent |
| `note` | Text or null | | ✓ | | ✓ | As written; "not recorded" when null |
| `booked_at` | UTC instant | | ✓ | | ✓ | Clinic's time zone |
| `booked_by` | Staff or null | | ✓ | | | "Not recorded" when null |
| `rescheduled_at`, `rescheduled_by` | Instant, staff, or null | | ✓ | | | Line left out when never rescheduled |
| `status_changed_at`, `status_changed_by` | Instant, staff, or null | | ✓ | | | Line left out when never changed |
| `cancellation_reason` | Text or null | | ✓ | | | Line left out when null |

## Status and what can be done

```text
                 ┌── reschedule ──┐
                 ▼                │
            scheduled ────────────┘
             │  │  │
  not started│  │  │ started
     cancel  │  │  │ no-show
             ▼  │  ▼
     cancelled  │  no_show
                │ check-in (Phase 7)
                ▼
           checked_in ──► completed (Phase 7 onward)
```

| Status | Started? | Offered |
|---|---|---|
| `scheduled` | No | Reschedule, cancel |
| `scheduled` | Yes | No-show |
| `cancelled`, `no_show`, `checked_in`, `completed` | Any | Nothing |

This table decides only what's offered. See [research R7](research.md).

## Free time

`date`, `start`, `end`, from `GET /doctors/{id}/slots`. Sent as `date` and `start` when booking or rescheduling, and the API takes `end` from the slot. Held in component state only.

## Booking form

| Value | Source | Quick feedback | API errors under |
|---|---|---|---|
| Patient | Chooser, or carried by number | Required | `patient_id` |
| Doctor | Chooser | Required | `doctor_id` |
| Free time | `FreeTimes` | Required | `date`, `start` |
| Note | Typed; trimmed; empty is left out | At most 500 characters | `note` |

Anything else, and `409`, appears at form level.

**State flow**

```text
patient ─choose─► doctor ─choose─► free times ─choose─► ready ─submit─► booked
   ▲                 │                 ▲                  │
   └──── change ─────┘                 │                  │
                     changing doctor clears the time      │
                                       └── refused about the time: read again, clear the time
```

Patient, doctor, and note survive every refusal. A successful booking resets all of it, then moves to the appointment's page.

## Cancel form

| Value | Quick feedback | API errors under |
|---|---|---|
| Reason, optional, trimmed, empty is left out | At most 255 characters | `reason`; `appointment` at page level |

## List filters, in the address

| Parameter | Sent as | Notes |
|---|---|---|
| `from`, `to` | The same | Defaults: [research R11](research.md) |
| `doctor_id` | The same | Includes inactive doctors |
| `patient_id` | The same | Only a number. Set by the chooser or a link |
| `status` | The same | One status. The API refuses an unknown one, on that filter |
| `outside_availability` | `1` | Only ever sent as true (FR-014) |
| `page` | The same | Dropped when any filter changes |

The doctor's list has `from`, `to`, `status`, and `page`, and defaults to today.

## Conversions

| Function | Input → output |
|---|---|
| `resolveRange(query, today)` | Address values → the range to read and show |
| `offeredActions(status, date, start, clinicNow)` | → which actions to offer |
| `isOutcomeUnknown(error)` | `true` for status `0` or `502` and above |
| `freeTimeWindow(from, today)` | → `{ from, to, previous, next }`, bounded by today and today + 90 |
| `clinicNow(timeZone)` | → `YYYY-MM-DD HH:mm` in the clinic's zone |
| `toBookingBody(values)` | Form → body; an empty note is left out |

Each is a pure function with its own unit tests. Dates never pass through local `Date` conversion.
