# ADR 0001: Authenticate through a Next.js BFF with a sealed HttpOnly cookie

**Status:** Accepted · **Date:** 2026-11-05

## Context

Verified at backend commit `dff2dca`:

- The API issues Sanctum bearer tokens only. Sanctum's cookie mode isn't enabled, and sessions aren't used.
- Tokens have an 8-hour idle expiry and no refresh endpoint.
- The brief prohibits storing tokens in `localStorage`, and the app holds medical data, so an XSS flaw that
  could read a token would be very serious.
- The backend must not be modified without an explicit request.

## Decision

The browser never receives the token. The Next.js server holds it for the session:

- `POST /api/auth/sign-in` calls Laravel, seals the token into an `HttpOnly`, `Secure` (in production),
  `SameSite=Lax` cookie with `iron-session`, and returns only the user object.
- Server Components call Laravel directly with the token from the cookie.
- Client Components call a same-origin proxy, `/api/backend/[...path]`, which attaches the token and locale.
- Sealing means that a copied cookie value is useless when sent directly to Laravel.

The proxy refuses `auth/sign-in`, checks `Origin` on state-changing methods, prevents path traversal, sets
`no-store`, and doesn't log bodies or query strings.

## Alternatives

| Option | Why not |
|---|---|
| Token in `localStorage` | Prohibited by the brief; readable by any XSS |
| Token in JavaScript memory, calling Laravel directly | Lost on every reload with no refresh endpoint, so staff would keep signing in; still exposed to XSS; requires CORS |
| Sanctum SPA cookie mode | Requires backend changes (`statefulApi`, CORS, sessions, same-site domains), and the backend's idle-timeout logic is built around tokens, so it would need rework |
| Server-side session store, with only an id in the cookie | Allows server-side revocation, but adds Redis or a database for little benefit, as Laravel already revokes tokens |
| Unsealed token in an HttpOnly cookie | Simpler, but a leaked value could be used directly at Laravel |

## Consequences

**Good:** the token is out of reach of JavaScript. CORS isn't needed, because the browser only talks to its
own origin. The Laravel URL stays private.

**Costs:**

- One extra network hop per client request. It should be small when both run close together.
- A new secret, `SESSION_SECRET`, must be managed. Rotating it signs everyone out.
- CSRF becomes this app's responsibility, and is handled with `SameSite` plus the `Origin` check.

**Requires a backend change before production.** Laravel uses `request()->ip()` for the audit trail and the
per-address sign-in limit, and it trusts no proxies. Through a BFF, every audit entry would show the Next.js
server's address, and all staff would share one limit of 20 sign-in attempts per minute. The fix is:

1. The BFF sends `X-Forwarded-For` with the real client address.
2. Laravel is configured to trust that header **only from the BFF's address** (`trustProxies`). Trusting any
   source would let a client forge its audit address.

Step 1 waits for this change too, as the right value depends on the deployment (Q6), and forwarding what a client sent would let it forge its
audit address once the backend trusts the header. All backend calls pass through one function, `callBackend`, so adding it is a small change.
[ADR 0010](0010-session-and-guards.md) records how sessions were built on this decision.

This is development-safe in the meantime, and the backend's own roadmap already calls for trusted-proxy
configuration. It won't be changed without the owner's explicit request. Staff-facing production use must
wait for it.
