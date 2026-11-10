# API Usage: Reports

Every operation below was checked in `contracts/reports.openapi.yaml` and the backend's `app/Modules/Reports`. Paths are relative to
`/api/v1`. "Browser" means through `/api/backend/...` from a Client Component; "server" means `serverApi()` in a Server Component.

## Operations

| Operation | Where | Used by | Audit entry | Refusals handled |
|---|---|---|---|---|
| `GET /reports/money-collected?from&to&doctor_id` | Browser, `onDemand` | Money collected | None | `401`, `403` (stop, clear), `404` (unknown doctor), `422` (on the choices) |
| `GET /reports/billing?from&to&doctor_id&page` | Browser, `onDemand` | Billing | None | Same |
| `GET /reports/activity?from&to&doctor_id&page` | Browser, `onDemand` | Activity | None | Same |
| `GET /reports/times?from&to&doctor_id&page` | Browser, `onDemand` | Times | None | Same |

Reused, unchanged:

| Operation | Where | Used by | Audit entry |
|---|---|---|---|
| `GET /doctors` (all pages) | Server | The doctor choice | None |

## Rules for every call here

- Read only when the report opens, when a choice or page changes, and on **Refresh** or **Try again**. Never on a timer, on focus, or on
  reconnect (ADR 0016).
- Nothing is sent while the period has a problem the frontend can see (research R3).
- `per_page` isn't sent, so the API's default of 15 applies, matching every other table.
- `Accept-Language` is the active locale. Messages are shown as sent and never matched by text. Field keys (`from`, `to`, `doctor_id`) are
  matched only as field names.
- The proxy logs no query strings. Report addresses hold only dates, a doctor's number, a page, and the report's name.
- Receptionists and doctors never reach these calls: `ScreenGate` refuses the page before anything is read, and the API answers `403`
  regardless.
