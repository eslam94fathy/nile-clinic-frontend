# Contract: API Usage

Every API operation these screens use, verified against the backend's contract and source at `dff2dca`. Paths are relative to `/api/v1`. All go through `browserApi` and the same-origin route; none is read on the server (research R1, R4).

All handle `401` (`browserApi` ends the session), `403`, and `404`. Below, "Keys" lists where a `422`'s errors go. Anything not listed goes to form level, so none is dropped.

| Operation | Used by | Audited | Keys |
|---|---|---|---|
| `GET /patients?name&phone&national_id&id&page&per_page` | Search on `/patients` | No | `name`, `phone`, `national_id`, `id`, each on its search field. `page` and `per_page` at form level |
| `GET /patients?phone&per_page=10` | Duplicate check on `/patients/new` | No | Treated as "the check couldn't run" |
| `POST /patients` | `/patients/new` | `patient.registered` | `full_name`, `date_of_birth`, `sex`, `phone`, `national_id`, `address`, `emergency_contact.name`, `.relationship`, `.phone` |
| `GET /patients/{id}` | `/patients/[id]` | **`patient.opened`, each read** | |
| `PATCH /patients/{id}` | Edit on `/patients/[id]` | `patient.updated`. **`patient.opened` if nothing changed**, which the form never sends | As `POST`. `emergency_contact` and `fields` at form level |

## Rules on these calls

- `GET /patients` is never sent with no filter (FR-003), and only ever when submitted.
- `GET /patients/{id}` has exactly four triggers: first mounting, an asked-for mark, "Reload details", and "Try again" after a failure. It's never retried automatically, and it isn't reachable from a server render or prefetch.
- `POST` and `PATCH` are never retried, and block double submission through `useFormSubmit`.
- The responses of `POST` and `PATCH` replace the record on screen, so nothing is read afterwards.

## Not used

Nothing else in the backend's patient module exists. There is no delete, merge, or duplicate-detection endpoint. A doctor's view of a patient comes from encounter endpoints in Phase 8.
