# Contract: `POST /api/auth/unlock`

A BFF route handler, beside `sign-in` and `sign-out`. Its reasons are in [research R3](../research.md#r3-unlocking-through-a-fresh-sign-in).

## Request

```http
POST /api/auth/unlock
Origin: <this site>
Accept: application/json
Accept-Language: ar | en
Content-Type: application/json

{ "password": "<typed by the person>", "userId": <the id of the person the page was opened for> }
```

The email always comes from the sealed cookie. The id only names whose page this is, so that the route can refuse when the cookie now
names someone else (code review, 2026-11-11).

## Steps

1. Refuse with `403` and `auth.errors.refused` unless `Origin` matches `Host` (same check as sign-in).
2. Refuse with `422` and `auth.errors.passwordRequired` on the `password` field if the body has no non-empty `password` string, or no
   positive whole `userId`.
3. Open the seal. If it has no `userId` or `email` (no cookie, tampered, or sealed before this phase), or its `userId` isn't the body's
   (someone else has signed in since, in another tab), answer `409` with `auth.lock.cannotUnlock` without calling the backend. The lock
   then offers only signing out.
4. `POST auth/sign-in` to the backend with `{ email: <sealed email>, password }`, the locale, and the forwarded client address (R5).
5. Backend `422` (wrong password, deactivated account, throttled): pass its body and status through unchanged. Nothing in the seal changes.
6. Backend `200`: parse `{ data: { token, user } }` with the existing schema.
   - If `user.id` differs from the sealed `userId`: `POST auth/sign-out` with the **new** token, leave the seal as it was, and answer `403`
     with `auth.lock.otherAccount`.
   - Otherwise, if the seal holds an old token, `POST auth/sign-out` with it and ignore the answer (it may have expired). Then seal
     `{ token: <new>, userId, email: user.email }` and answer `200` with `{ data: user }`. Sealing also clears the lock marker `nile_locked` (ADR 0020).
7. Anything else, including no answer: `502` with `auth.errors.general`. Nothing in the seal changes.

Every answer sends `Cache-Control: no-store`. Neither the password nor any token appears in a response body, a header other than the sealed
`Set-Cookie`, or any log.

## Answers

| Status | Body | The lock does |
|---|---|---|
| `200` | `{ data: StaffMember }` | Closes, returns focus, clears the field |
| `422` | Backend's `{ message, errors }` | Shows `message` under the field (G5: throttle wait as sent), stays locked, clears the field |
| `403` | `{ message }` | Shows `message` at form level, stays locked |
| `409` | `{ message }` | Shows `message`, hides the password field, keeps only sign-out |
| `502` / no answer | `{ message }` or nothing | Shows the message or `shared.errors.noResponse`, stays locked, keeps the field |

## Sign-in change

`POST /api/auth/sign-in` seals `{ token, userId: user.id, email: user.email }` instead of `{ token }`. Its responses don't change.
`readSessionToken()` keeps its signature. Nothing else reads the new fields.

## Audit entries

A successful unlock writes `auth.sign_in` and, when the old token still existed, `auth.sign_out`. A refused one writes the backend's
refused `auth.sign_in`. Neither re-reads a record or a history (FR-007).
