# API Usage: Audit Log

Checked in the backend's `specs/011-audit-logs/contracts/audit.openapi.yaml` and `app/Modules/Audit`. Paths are relative to `/api/v1`.
"Browser" means through `/api/backend/...` from a Client Component; "server" means a Server Component.

## Operations

| Operation | Where | Used by | Audit entry | Refusals handled |
|---|---|---|---|---|
| `GET /audit-entries?from&to&staff_id&patient_id&subject_type&subject_id&action&outcome&per_page=25&cursor` | Browser, in a press handler only | The search, Older, Newer, Try again, Start again | **`audit.searched`, one per request** | `401` (session ends), `403` (clear, re-gate), `422` (on the filter, or `cursor` on the pager), no answer and `5xx` (error with Try again) |

Reused, unchanged:

| Operation | Where | Used by | Audit entry |
|---|---|---|---|
| `GET /staff?per_page=100&page` (all pages) | Server | The staff choice | None |

## Rules for every call here

- **Only on a press** (research R1). Never on opening, focus, reconnecting, being shown again, a timer, a refresh, or a retry by itself.
- **One request per press** (research R2).
- **Empty filters aren't sent.** `cursor` is sent only by Older and Newer, with the filters of the page shown, never the form's.
- Nothing is sent while a filter has a problem the frontend can see (research R9), so no entry is written for it.
- `Accept-Language` is the active locale. Messages are shown as sent and never matched by text. Field keys are matched only as names.
- The response is held in memory only. The same-origin route sends `no-store` and removes `links` and `meta.path`.
- The proxy and the route log no query strings. The page's own address is always `/{locale}/audit`, with no query.
- Receptionists and doctors never reach the call: `ScreenGate` refuses the page first, and the API answers `403` regardless.

## Links out (no API call by the audit page)

| Shown | Goes to | Audited when followed |
|---|---|---|
| Patient number, `patient` subject | `PatientLink` → `/patients/{id}` | Yes, `patient.opened`, by the click |
| `staff_member` subject, staff actor | `/staff/{id}` | No |
| `doctor` subject | `/doctors/{id}` | No |
| `appointment` subject | `/appointments/{id}` | No |
| `charge` subject | `/charges/{id}` | No |
| `specialty`, `time_off`, `visit`, `encounter` | Text only | — |
