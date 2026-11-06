# Contract: BFF Routes

Same-origin routes that browsers call. Backend behaviour is defined by `contracts/staff-auth.openapi.yaml` and `contracts/doctors.openapi.yaml`.

**Every route**: responses carry `Cache-Control: no-store`. Nothing logs bodies, query strings, tokens, or credentials. Calls to the backend use `redirect: "manual"`, a timeout, and no cache. The browser's `Accept-Language` is forwarded only when it is exactly `ar` or `en`.

**Every state-changing route**: needs an `Origin` whose host equals `Host`. Otherwise `403`, with a translated `message`, and the backend isn't called.

## `POST /api/auth/sign-in`

**Body**: `{ "email": string, "password": string }`. Any other shape gets `422`, with `errors` on the affected fields and no backend call.

| Backend answer | Response |
|---|---|
| `200` | `200` `{ "data": <StaffMember> }`, with the sealed cookie set. **The token isn't in the body** |
| `422` | `422`, with the backend's body |
| Any other, or no answer | `502` `{ "message": <translated general text> }`. No cookie |
| `200` of the wrong shape | Same `502`. No cookie |

## `POST /api/auth/sign-out`

Asks the backend to end the token, if there is a session, then always clears the cookie. Returns `204`, whatever the backend answered. The token stays valid at the backend until its idle limit if that call failed, but nothing can present it, because the only copy was in the cookie.

## `GET /api/auth/session-ended`

**Query**: `locale` (`ar` or `en`, otherwise the default) and `return` (validated as in [the data model](../data-model.md#return-address-libauthreturn-addressts)).

| API says about the current token | Effect |
|---|---|
| No session, or `401` | Clears the cookie. `303` to `/{locale}/sign-in?ended=1`, plus `return` if it's safe |
| Valid, or the API is failing | Leaves the cookie alone. `303` to `/{locale}/dashboard` |

Because it asks the API first, a link to this address can't end someone's working session.

## `/api/backend/[...path]`

Methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`.

**Refused with no backend call**

| Case | Status |
|---|---|
| Path, once decoded and any case, is `auth/sign-in` or `auth/sign-out` | `404` |
| A segment is `.` or `..` after decoding, or holds an encoded slash, backslash, or control character; or the percent-encoding is malformed | `404` |
| State-changing, and `Origin` fails | `403` |
| No readable session | `401`, with a translated `message` |
| `Accept` doesn't ask for `application/json`, as with a link opened from elsewhere, which would otherwise reach audited reads | `406` |

**Forwarded**: method, path, query string, body, `Content-Type`, `Accept: application/json`, the validated `Accept-Language`, and `Authorization: Bearer <token>`. No browser cookies or other headers.

**Returned**: the backend's status and `Content-Type`, and its body, with `links`, `meta.links`, and `meta.path` removed from JSON objects that have them. No other backend headers. A redirect from the backend, no answer, a body that fails partway, or a body that isn't JSON (such as an nginx error page) gets `502` with a translated `message`.

A backend `401` passes through unchanged, and the browser client ends the session.

## Browser client (`lib/api/browser-api.ts`)

- Always calls `/api/backend/...`, and sends the active locale as `Accept-Language`.
- `401`: starts the one session end ([app shell contract](app-shell.md#session-end)), and the caller's result is discarded.
- Failures become `ApiError`. Never retries a mutation.
