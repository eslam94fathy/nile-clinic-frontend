# ADR 0021: A static security policy that allows inline scripts, strict otherwise

**Status:** Accepted, by the project owner after Phase 13's review, 2026-11-12

Amends the expectation in [ADR 0007](0007-design-system-foundation.md) that a strict policy "must allow the theme script by hash or nonce".
Keeps [ADR 0006](0006-cache-components.md) unchanged. See [research](../../specs/013-hardening/research.md), R1 and R2, and the
[header contract](../../specs/013-hardening/contracts/security-headers.md).

## Context

Measured on the production build (2026-11-11): every page streams about a dozen inline scripts written at request time, carrying that
request's data, and the prerendered shell holds inline scripts built before any request. Next.js's guide says nonces need every page
rendered per request and are incompatible with Partial Prerendering; its experimental integrity option covers script files only. A hash of
the theme script alone would make browsers ignore `'unsafe-inline'` and block the rest.

## Decision

- One static policy on every response, set by `headers()` in `next.config.ts` from a constant in `src/lib/security/headers.ts`:
  `default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self';
  connect-src 'self'; manifest-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'`.
- Also from the application: `nosniff`, `Referrer-Policy: same-origin`, `X-Frame-Options: DENY`, a `Permissions-Policy` turning off unused
  device features, and same-origin opener and resource policies.
- The reverse proxy sets `Strict-Transport-Security`, and no policy of its own.
- `react/no-danger` is an error; the theme script is the one exception.
- Zod runs `jitless` in the browser (`src/instrumentation-client.ts`), so it doesn't probe for `eval`, which the policy forbids.

The owner chose this on 2026-11-11 over giving up prerendering.

## Alternatives

| Option | Why not |
|---|---|
| Nonce with `strict-dynamic` | Every page rendered per request, reversing ADR 0006, and the proxy passing on a modified request, close to Phase 1's 404s |
| Hash of the theme script | Blocks the streamed inline scripts |
| Experimental SRI | Files only; experimental |
| All headers at the proxy | Untested by the repository; lost if the proxy changes |

## Consequences

- An injected inline script could run. It couldn't load code from elsewhere or send data to another site by fetch, image, font, or form,
  and the page can't be framed. React's escaping and the lint rule are the defense against the injection itself.
- If Next.js later supports nonces with prerendered shells, this should be revisited.
