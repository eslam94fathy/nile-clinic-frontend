# API Usage: Queue

Verified against `specs/007-patient-queues/contracts/queues.openapi.yaml` and source in the backend, at commit `dff2dca`. Confirmed on the running API by `e2e/live/queue.spec.ts`, as implementation proceeds.

## Operations

| Operation | Read from | Roles | Audit | Success | Failures handled |
|---|---|---|---|---|---|
| `POST /appointments/{id}/check-in` | Browser | A R | `visit.checked_in` | `201`, entry | `401`, `403`, `404`, `409`, `422` |
| `GET /queue?status&page&per_page` | Browser, every 15 s | A R | None | `200`, page | `401`, `403`, `422` |
| `GET /doctors/{id}/queue` | Browser, every 15 s | A R | None | `200`, array | `401`, `403`, `404` |
| `POST /queue/walk-ins` | Browser | A R | `visit.walk_in_added` | `201`, entry | `401`, `403`, `409`, `422` |
| `POST /queue/{entry}/leave` | Browser | A R | `visit.left` | `200`, entry | `401`, `403`, `404`, `422` |
| `DELETE /queue/{entry}` | Browser | A R | `visit.check_in_undone` | `204` | `401`, `403`, `404`, `422` |
| `GET /doctors/me/queue` | Browser, every 15 s | D | None | `200`, array | `401`, `403`, `404` (no profile) |
| `POST /doctors/me/queue/call-next` | Browser | D | `visit.called` | `200`, own entry | `401`, `403`, `404`, `409`, `422` |
| `POST /doctors/me/queue/finish` | Browser | D | `visit.finished` | `200`, own entry | `401`, `403`, `404`, `422` |

## Other features' operations used here

| Operation | Read from | Used for | Audit |
|---|---|---|---|
| `GET /doctors?per_page=100&page` | Server | The Queue page's doctor filter, every page, including inactive doctors | None |
| `GET /doctors?is_active=1&name&specialty_id&page` | Browser | Choosing a doctor for a walk-in | None |
| `GET /specialties` | Server | Choosing a doctor | None |
| `GET /patients?name&phone&national_id&id&page` | Browser | Choosing a patient. Never sent with no term | None |
| `GET /patients?id=N` | Browser | Showing a carried or chosen patient | None. **Never `GET /patients/{id}`** |

`GET /patients/{id}` only happens when a person follows a `PatientLink` from a Queue page row, and writes one true `patient.opened`. "My queue" has no such link.

`GET /appointments/{id}` is read by the appointment's page, as in Phase 6.

## Bodies

```json
POST /queue/walk-ins
{ "patient_id": 12, "doctor_id": 3 }
```

Everything else has no body. A doctor's actions never send an entry's id: the API works out the current and next patient.

## Error keys

| Source | Keys | Where |
|---|---|---|
| Check-in | `appointment` | At page level, and the page refreshes |
| Walk-in | `patient_id`, `doctor_id` | On the chosen patient or doctor |
| Left, undo | `entry` | In the dialog |
| Call next, finish | `queue` | In the dialog |
| `409` | `message` and `reason` only | At form level, page level, or in the dialog |
| Anything else | | At form level, never dropped |

`reason` values here: `already_checked_in`, `patient_with_another_doctor`. The contract calls both database backstops, normally unreachable. `POST /queue/walk-ins` lists a `409` too, and the backend's own verification found no code path that returns it.

`not_checkable`, `already_in_queue`, `not_changeable`, `has_active_charge`, `visit_in_progress`, `nobody_waiting`, and `no_current_visit` are translation keys and **aren't sent**, so they're never compared. `has_active_charge` can't occur until Phase 9.

## Limits

| Limit | Value | Where it's met |
|---|---|---|
| `per_page` | 100 | `GET /queue` always sends 100 |
| Dates | None: always the clinic's today | No date is sent |
| Status filter | One, on `/queue` only | A chosen doctor's list is filtered on screen, as it's complete |

## Order

`/queue` is by doctor id, then queue order. A doctor's list is in queue order: each booked patient by appointment start, each walk-in by arrival, then by number. It's never re-sorted here.
