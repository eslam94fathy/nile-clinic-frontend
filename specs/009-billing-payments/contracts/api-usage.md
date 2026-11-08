# API Usage: Billing and Payments

Every operation below was checked in `contracts/payments.openapi.yaml` and the backend's `app/Modules/Payments`. Paths are relative to
`/api/v1`. "Browser" means through `/api/backend/...` from a Client Component; "server" means `serverApi()` in a Server Component.

## Operations

| Operation | Where | Used by | Audit entry | Refusals handled |
|---|---|---|---|---|
| `GET /visits?date&doctor_id&charge_status&page&per_page=100` | Browser, `live` for today, `onDemand` otherwise | Billing | None | `401`, `403` (stop, clear), `422` (form-level, filters kept) |
| `POST /visits/{visit}/charge` | Browser | Billing | `charge.created` | `404`; `422` on `visit` (left, already charged, no fee) |
| `GET /charges?from&to&patient_id&doctor_id&status&page` | Server | Charges | None | `401`, `403`, `422` (on the range, shown with the filters) |
| `GET /charges/{charge}` | Server | A charge's page | None | `401`, `403`, `404` (neutral not found) |
| `POST /charges/{charge}/payments` `{amount, method}` | Browser | Record payment | `payment.recorded` | `404`; `422` on `amount` (incl. above the balance), `method`, `charge` (cancelled) |
| `POST /charges/{charge}/refunds` `{amount, method, reason}` | Browser | Record refund (administrators) | `refund.recorded` | `403`, `404`; `422` on `amount` (incl. above what was paid), `method`, `reason`, `charge` |
| `PUT /charges/{charge}/discount` `{amount, reason}` | Browser | Set discount (administrators) | `discount.set` | `403`, `404`; `422` on `amount` (incl. too large), `reason`, `charge` |
| `POST /charges/{charge}/cancel` `{reason}` | Browser | Cancel charge | `charge.cancelled` | `404`; `422` on `reason`, `charge` (money held, already cancelled) |

Reused, unchanged:

| Operation | Where | Used by | Audit entry |
|---|---|---|---|
| `GET /doctors` (all pages) | Server | Doctor filters on both lists | None |
| `GET /patients?id=N` | Browser | The chosen patient on Charges, through `PatientFilter` | None |
| `GET /patients?search=…` | Browser | Choosing a patient on Charges | None |
| `GET /patients/{id}` | Browser, only when a person follows a patient's name | The patient's page | **`patient.opened`**, never prefetched (ADR 0005, 0012) |
| `DELETE /queue/{entry}` | Browser | Phase 7's undo, unchanged | Refused with `422` on `entry` while the visit has an active charge |

## Rules for every call here

- **No money action is ever retried or resent automatically** (research R4). `browserApi` never retries a mutation, and an unknown outcome
  is shown as one.
- After any money action, success or refusal, the page refreshes: `router.refresh()` on a charge's page, invalidation of `["billing"]` on
  Billing.
- `Accept-Language` is the active locale. Messages are shown as sent and never matched by text. Field keys are matched only as field names.
- Amounts are sent as strings with Western digits and at most two decimals. Charging sends no body.
- Lists send `per_page=100` on Billing, so that a day rarely needs paging, and the default on Charges.
- Reasons are never put in an address, a log, or browser storage. The proxy logs no bodies and no query strings.
- A doctor never reaches these calls: `ScreenGate` refuses the pages before any read, and the API answers `403` regardless.
