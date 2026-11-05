# Data Model: Project Foundation

No database or persistent application data. These are the values the feature handles.

## Health response (from the backend)

Generated from contract `health.openapi.yaml`. Never written by hand.

| Field | Values |
|---|---|
| `status` | `ok`, `unavailable` |
| `checks.database` | `ok`, `unavailable` |

## Connectivity status

The result of classifying one check. Held only for the request.

| Status | Condition |
|---|---|
| `working` | Body matches the contract, with `status: ok` and `checks.database: ok` |
| `unavailable` | HTTP status is `200` or `503`, the body matches the contract, and anything in it reports `unavailable` |
| `unreachable` | Network error, 5-second timeout, any other HTTP status including redirects, a body that doesn't match the contract, or a healthy body with `503` |

`checking` is a display state during streaming or refresh, not a result.

Transitions: each page request or "check again" produces a new, independent result. Nothing is stored.

## Configuration

Server-only. Validated at startup.

| Setting | Required | Rule | Notes |
|---|---|---|---|
| `BACKEND_API_URL` | Yes | Absolute `http` or `https` URL | Includes `/api/v1`; a trailing slash is removed |
| `CLINIC_TIMEZONE` | No | Valid IANA time zone; default `Africa/Cairo` | Must match the backend's setting |

## Language choice

| Attribute | Value |
|---|---|
| Cookie | `NEXT_LOCALE`, not `HttpOnly` because the switch writes it from the browser |
| Values | `ar`, `en`; anything else is ignored |
| Lifetime | One year |
| Personal data | None |

## Contract snapshot

| Item | Location |
|---|---|
| 11 contract files | `contracts/*.openapi.yaml` |
| Source record | `contracts/SOURCE.json`: `repository`, `commit`, `copiedAt` |
| Generated types | `src/lib/api/generated/<contract>.ts`, one per contract |
