# Contract: API Usage

Every API operation these screens use, verified against the backend's contracts and source at `dff2dca`. Paths are relative to `/api/v1`. **S** means read on the server through `serverApi`, and **B** means called from the browser through `browserApi`.

All reads and writes also handle `401`, `403`, and `404`. Below, "Keys" lists where a `422`'s errors go. Anything not listed there goes to form level, so none is dropped.

## Staff

| Operation | Via | Used by | Keys |
|---|---|---|---|
| `GET /staff?role&is_active&page&per_page` | S | `/staff`, account chooser on `/doctors/new` | Invalid filter gives `422`: shown through `ApiFailureState` |
| `POST /staff` | B | `/staff/new` | `name`, `email`, `role`, `password`, `password_confirmation` |
| `GET /staff/{id}` | S | `/staff/[id]`, `/doctors/new?account=` | |
| `PATCH /staff/{id}` | B | `/staff/[id]` | `name`, `email`, `role`. Last administrator: `message` only |
| `POST /staff/{id}/deactivate` | B | `/staff/[id]` | Last administrator: `message` only, shown in the dialog |
| `POST /staff/{id}/reactivate` | B | `/staff/[id]` | |
| `PUT /staff/{id}/password` | B | `/staff/[id]`, not on one's own | `password`, `password_confirmation`. `204`, no body |

## Specialties

| Operation | Via | Used by | Keys |
|---|---|---|---|
| `GET /specialties?is_active` | S | `/specialties`, doctor forms and filters | Not paginated |
| `POST /specialties` | B | `/specialties` | `name_en`, `name_ar` |
| `PATCH /specialties/{id}` | B | `/specialties` | `name_en`, `name_ar`. An empty body is `422`, which the form avoids by sending nothing |
| `POST /specialties/{id}/deactivate`, `/reactivate` | B | `/specialties` | |

## Doctors

| Operation | Via | Used by | Keys |
|---|---|---|---|
| `GET /doctors?name&specialty_id&is_active&page&per_page` | S | `/doctors` | |
| `POST /doctors` | B | `/doctors/new` | `user_id`, `title`, `registration_number`, `specialty_ids`, `specialty_ids.N` |
| `GET /doctors/{id}` | S | `/doctors/[id]`, `/edit`, `/schedule` | |
| `PATCH /doctors/{id}` | B | `/doctors/[id]/edit` | `title`, `registration_number`, `specialty_ids`, `specialty_ids.N` |

`specialty_ids.N` is shown on the specialties group. `GET /doctors/me` is already used by `ScreenGate`.

## Scheduling

| Operation | Via | Used by | Keys |
|---|---|---|---|
| `GET /doctors/{id}/schedule` | S | `/doctors/[id]`, `/schedule` | |
| `PUT /doctors/{id}/schedule` | B | `/doctors/[id]/schedule` | `appointment_minutes`, `periods`, `periods.N`, `periods.N.day`, `.start`, `.end` |
| `DELETE /doctors/{id}/schedule` | B | `/doctors/[id]/schedule` | `204` |
| `GET /doctors/{id}/slots?from&to` | S | `/doctors/[id]` | Range limits: research R9 |
| `GET /doctors/{id}/time-off?from&to` | S | `/doctors/[id]` | `from`, `to`: shown through `ApiFailureState` |
| `POST /doctors/{id}/time-off` | B | `/doctors/[id]` | `start_date`, `end_date`, `start_time`, `end_time`, `reason` |
| `DELETE /doctors/{id}/time-off/{timeOff}` | B | `/doctors/[id]` | Already ended: `422`, shown in the dialog. `204` on success |
| `GET /doctors/me/schedule` | S | `/my/schedule` | |
| `GET /doctors/me/slots?from&to` | S | `/my/schedule` | |
| `GET /doctors/me/time-off?from&to` | S | `/my/schedule` | |

## Fees

| Operation | Via | Used by | Keys |
|---|---|---|---|
| `GET /fees?page&per_page` | S | `/fees` | |
| `GET /doctors/{id}/fee` | S | `/doctors/[id]` | Doctors get `403`, but can't reach this page |
| `PUT /doctors/{id}/fee` | B | `/doctors/[id]` | `amount` |

## Not used

`POST /visits/{id}/charge` and other charging operations are Phase 9. Listing appointments is Phase 6 (the owner's decision in the spec's clarifications).

## Rules for callers

- `is_active` filters are sent as `1` or `0`, as the contract states.
- No message is ever compared in code.
- Page size stays at the API's default, except the account chooser on `/doctors/new`, which uses `per_page=50`.
- Response bodies are checked with Zod schemas that `satisfies z.ZodType<Generated>`. A body that fails counts as a failed read.
