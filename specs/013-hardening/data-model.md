# Data Model: Hardening and Production Readiness

No new backend data. Everything below lives in the sealed cookie, in one page's memory, or in documents.

## Sealed session

The iron-session seal in the `nile_session` cookie (HttpOnly, `SameSite=Lax`, `Secure` in production, ends with the browser).

| Field | Type | Set by | Read by |
|---|---|---|---|
| `token` | string | sign-in, unlock | every backend call (unchanged) |
| `userId` | number | sign-in, unlock (**new**) | unlock only |
| `email` | string | sign-in, unlock (**new**) | unlock only |

- A seal without `userId` or `email` (made before this phase) is still a valid session; it just can't unlock (`409`).
- The browser never sees any field. The email isn't secret, but it's sealed so that the lock can't be pointed at another account (R3).
- Role and name are still read from `/auth/me` per request, never from the seal.

## Inactivity lock

Per mounted `InactivityLock`, in memory only. Never stored, never sent.

| Field | Type | Meaning |
|---|---|---|
| `lastActivityAt` | number (ms since epoch), in a ref | Last qualifying activity on the document |
| `state` | `active` · `locked` · `unlocking` · `confirmingSignOut` · `signingOut` | See transitions |
| `canUnlock` | boolean | `false` after a `409` |
| `error` | string or null | Last refusal's message, as sent |
| `returnFocusTo` | element or null | Focused element when the lock opened |

```text
active ──(5 min without activity, or found expired on show)──▶ locked
locked ──(submit password)──▶ unlocking
unlocking ──200──▶ active                      (field cleared, focus returned)
unlocking ──422/403/502/none──▶ locked         (error shown; field cleared except on 502/none)
unlocking ──409──▶ locked, canUnlock = false
locked ──(sign out)──▶ confirmingSignOut ──(cancel)──▶ locked
confirmingSignOut ──(confirm)──▶ signingOut ──success──▶ leave page (full navigation)
signingOut ──failure──▶ locked                  (error shown)
```

Validation: the password must be non-empty before submitting (client hint only; the route checks too).

## Security policy

The header set in [security-headers](contracts/security-headers.md), held as one constant in `src/lib/security/headers.ts` and used by
`next.config.ts` and the header tests, so the two can't drift.

## Review record

`specs/013-hardening/review.md`, one table per review (security, accessibility by hand, performance):

| Field | Meaning |
|---|---|
| Finding | What was found, with where |
| Severity | High · Medium · Low |
| Outcome | Fixed (commit) · Accepted by the owner (date) · Not a problem (why) |

The phase isn't accepted while a finding has no outcome (SC-009).

## Pre-production item

A list in `docs/deployment.md`, replacing the roadmap's "Before production" bullets with links:

| Field | Values |
|---|---|
| Item | e.g. "Trust the frontend's address on the backend" |
| Owner | Backend · IT · Legal · Clinic management |
| Reference | H2, H4, G9, the Phase 8 privacy review, … |
| Status | Open · Done (date) |
