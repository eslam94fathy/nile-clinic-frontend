# Data Model: Queue

Nothing here is stored by the frontend. These are the API's shapes as this phase uses them, verified against `contracts/queues.openapi.yaml`. Names come from `src/lib/api/generated/queues.ts`.

## Entities

### Queue entry (reception)

`components["schemas"]["QueueEntry"]`

| Field | Type | Shown as |
|---|---|---|
| `id` | number | Not shown. Used for actions, and equal to a visit's id |
| `queue_number` | number | As sent, labelled as a number, never as a position |
| `status` | `QueueStatus` | Translated, with the shared status mapping |
| `walk_in` | boolean | A text label |
| `arrived_at` | instant | Clinic's time zone |
| `called_at`, `finished_at`, `left_at` | instant or null | Clinic's time zone. Left out when null |
| `appointment` | `{ id, start, end }` or null | Times as sent, linking to the appointment. Null for a walk-in |
| `doctor` | `{ id, name, title }` | The group's heading, as written |
| `patient` | `{ id, full_name, phone }` | Number, name as a `PatientLink`, and phone |

### Queue entry (doctor)

`components["schemas"]["OwnQueueEntry"]`. The same, with no `doctor`, and `patient` as `{ id, full_name, sex, date_of_birth }`. Sex is translated, and date of birth is shown as sent. There's no phone or contact detail, and the name isn't a link.

## State transitions

```text
                 check-in, or walk-in
                         │
                         ▼
   undo (appointment only) ◄── waiting ──► left   (reception, permanent)
   entry removed; number        │
   not reused; appointment      │ call next (doctor; API chooses who)
   scheduled again              ▼
                           with_doctor
                                │ finish (doctor)
                                ▼
                              seen        appointment becomes completed
```

Appointment status alongside it: `scheduled` → `checked_in` on check-in, → `scheduled` on undo, → `completed` on finish. Neither `checked_in` nor `completed` offers any change on its page.

## Filters

From the Queue page's address, by `readQueueFilters`:

| Parameter | Valid when | Otherwise |
|---|---|---|
| `doctor_id` | A positive whole number (`readPositiveId`) | Ignored |
| `status` | One of `waiting`, `with_doctor`, `seen`, `left` | Ignored |
| `page` | A positive whole number, with no doctor chosen | Ignored |

## Query keys

Under the root `["queue"]`, so one invalidation refreshes everything on screen.

| List | Key |
|---|---|
| Whole clinic | `["queue", "clinic", { status, page }]` |
| One doctor | `["queue", "doctor", doctorId]` |
| Own | `["queue", "own"]` |

## The `live` policy

In `lib/api/live-query.ts`, as ADR 0005 asks for one module:

| Option | Value | Why |
|---|---|---|
| `staleTime` | `0` | A list shown again reads at once |
| `refetchInterval` | `15_000` | Roadmap decision Q4 |
| `refetchIntervalInBackground` | `false` | Roadmap decision Q2 |
| `refetchOnWindowFocus`, `refetchOnReconnect`, `refetchOnMount` | Defaults (on) | ADR 0005's "live" kind |
| `retry` | Once, for status `0` or `5xx` | ADR 0005 allows it; `4xx` never |
| `networkMode` | `"always"` | A failure must show, not pause silently |

## Conversions

| Function | Input | Output |
|---|---|---|
| `readQueueFilters` | The page's search parameters | `{ doctorId, status, page }`, each or nothing |
| `groupByDoctor` | Entries in API order | `{ doctor, entries }[]`, adjacent rows only, order unchanged |
| `offeredEntryActions` | Entry | `("mark_left" \| "undo")[]` |
| `offeredOwnAction` | Own entries | `"finish"`, `"call_next"`, or `null` |
| `applyEntry` | Own entries, one entry from the API | The list with that entry replaced by `id` |
| `offeredActions` | Gains `check_in` | When `scheduled`, and the date is `clinicNow`'s date |
