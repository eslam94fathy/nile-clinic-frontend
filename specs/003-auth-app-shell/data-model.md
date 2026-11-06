# Data Model: Authentication and App Shell

The application stores no business data. These are the shapes it holds or passes around. API types come from the generated files, and aren't redefined.

## Session (server-sealed, in the cookie)

| Field | Type | Notes |
|---|---|---|
| `token` | string | The API's bearer token. Never leaves the server unsealed |

Holds nothing else. The role and name are read from the API on each request, so they can't go stale in the cookie.

| Cookie attribute | Value |
|---|---|
| Name | `nile_session` |
| `HttpOnly` | Yes |
| `Secure` | In production |
| `SameSite` | `Lax` |
| `Path` | `/` |
| Lifetime | Ends with the browser; no seal expiry. The API's idle limit decides |

**States**: absent or unreadable → no session. Present → unknown until the API answers.

## Current user (from `GET /auth/me`, per request)

`StaffMember` from the `staff-auth` contract: `id`, `name`, `email`, `role`, `is_active`, `created_at`, `updated_at`.

The read gives one of three outcomes:

| Outcome | When | Effect |
|---|---|---|
| `signed-in` | `200` | Provides the user |
| `no-session` | No usable cookie, or `401` | Ends the session |
| `unavailable` | `5xx`, network failure, timeout, or a body of the wrong shape | Error with retry; the session stays |

## Doctor profile status (from `GET /doctors/me`, for the doctor role only)

| Status | When |
|---|---|
| `present` | `200` |
| `missing` | `404` |
| `unknown` | Anything else. Shows the error with retry, never "not set up" |

`401` ends the session, as everywhere. `403` means the role changed since the check, and shows the "not allowed" state, because the API's answer wins over the role map. The next page load's role check takes over.

## Role map (`lib/auth/permissions.ts`)

`Capability` has one value for each of the 18 rows of the [permission matrix](../../docs/backend-integration.md#permission-matrix). `can(role, capability)` is the only way to read it.

| Capability | Matrix row | Roles |
|---|---|---|
| `ownAccount` | Own profile, own password, sign out | A R D |
| `manageStaff` | Manage staff accounts | A |
| `readDoctors` | Read specialties and doctors | A R D |
| `manageDoctors` | Change specialties and doctor profiles | A |
| `readSchedules` | Read any doctor's schedule, slots, time off | A R D |
| `manageSchedules` | Change schedules and time off | A |
| `managePatients` | Patients | A R |
| `manageAppointments` | Appointments | A R |
| `readOwnAppointments` | Own appointments, read only | D |
| `manageQueue` | Queue | A R |
| `ownQueue` | Own queue | D |
| `medicalRecords` | Medical records | D |
| `readFees` | Read fees | A R |
| `setFees` | Set fees | A |
| `billing` | Visits and charges | A R |
| `discountAndRefund` | Discount and refund | A |
| `reports` | Reports | A |
| `auditTrail` | Audit trail | A |

A test reads the matrix table from the document and compares every cell, so a change on either side fails.

## Route table (`lib/auth/app-routes.ts`)

One entry per signed-in destination, in navigation order.

| Field | Type | Notes |
|---|---|---|
| `path` | string | Under the locale, such as `my/queue` |
| `capability` | `Capability` | Who may use it |
| `onlyRoles` | `Role[]`, optional | Narrows a capability, where the blueprint offers a screen to fewer roles than the API allows. Must be a subset of the capability's roles, which a test checks |
| `labelKey` | string | Translation key |
| `inNavigation` | boolean | `account` is false, as it's in the top bar |
| `built` | boolean | `false` means the catch-all shows the placeholder |

| Path | Capability | `onlyRoles` | Built here |
|---|---|---|---|
| `dashboard` | `ownAccount` | | Yes |
| `account` | `ownAccount` | | Yes |
| `patients` | `managePatients` | | |
| `appointments` | `manageAppointments` | | |
| `queue` | `manageQueue` | | |
| `billing`, `charges` | `billing` | | |
| `doctors` | `readDoctors` | A R | |
| `specialties` | `manageDoctors` | | |
| `fees` | `readFees` | | |
| `staff` | `manageStaff` | | |
| `reports` | `reports` | | |
| `audit` | `auditTrail` | | |
| `my/queue` | `ownQueue` | | |
| `my/appointments` | `readOwnAppointments` | | |
| `my/visits` | `medicalRecords` | | |
| `my/schedule` | `readSchedules` | D | |

The `doctor area` is every path starting with `my/`, plus `dashboard` for a doctor.

**Later phases** add a real route, whose folder takes priority over the catch-all, and set `built: true`.

The proxy reads the table's first path segments to tell signed-in addresses from unknown ones.

## Return address (`lib/auth/return-address.ts`)

Input: anything from a query string. Output: a safe, locale-free path, or `null`, which means the landing page.

Refused: anything not starting with one `/`; `//`; backslashes; control characters; malformed percent-encoding; a scheme; `.` or `..` segments after decoding; encoded slashes; `sign-in`; `api`; `_next`.

The query and fragment are always dropped.

**Audited pages** go to the landing page, matched after decoding: `patients/<anything>`, `my/encounters/<anything>`, `my/patients/<anything>`, `audit`. The list is held here alone. Phase 11 may narrow `audit`, as its search runs only on submit.

## Sign-in form

| Field | Client check | API rule |
|---|---|---|
| `email` | Required | Decides everything else |
| `password` | Required | Decides everything else |

## Password form

| Field | Client check | API rule |
|---|---|---|
| `current_password` | Required | Must be correct; attempts are limited |
| `password` | 12–72 characters | Same, and the API's answer wins |
| `password_confirmation` | Matches `password` | Same |

## API error (`lib/api/api-error.ts`)

| Field | Notes |
|---|---|
| `status` | HTTP status, or `0` when no response arrived |
| `message` | As sent, or absent when the body wasn't the expected shape. The caller then uses translated general text |
| `fieldErrors` | `errors`, keyed as sent, including nested keys |
| `reason` | The 409 `reason`, when present |

Message text is never compared.

## Confirmed list metadata (`lib/api/pagination.ts`)

`current_page`, `last_page`, `per_page`, `total`, `from`, `to` (see research R1). `links`, `meta.links`, and `meta.path` never reach the browser.
