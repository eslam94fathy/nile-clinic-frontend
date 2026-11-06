# ADR 0010: How sessions are read, ended, and checked

**Status:** Proposed, for acceptance with Phase 3 · **Date:** 2026-11-06

Decided during Phase 3 planning and tested with a production spike against the real backend. See
[research](../../specs/003-auth-app-shell/research.md). This builds on [ADR 0001](0001-authentication-bff.md).

## Context

Testing found that four assumptions from the design didn't hold:

- A default link's prefetch runs cookie-based reads on the server. Three links in view meant four identity calls per page load.
- A Server Component can't clear a cookie, and a redirect can't change a response that has started streaming.
- Paginated API responses hold Laravel's private address and the request's query string.
- A plain form submits by itself before React hydrates, using GET, which would put a password in the address.

## Decision

1. **Every server read of the API goes through `lib/api/server-api.ts`, which calls `await connection()` first.** This keeps it out of
   prefetch shells, so no link can reach the API, restart its idle timer, or touch an audited read. Measured: one identity call per page
   load or navigation, and none from prefetching.
2. **The cookie ends with the browser, and the seal has no expiry of its own.** The owner chose this for shared computers. A fixed seal
   lifetime would end sessions that the API still considers valid.
3. **Checks live in pages, not the layout.** Each page wraps all its content in `ScreenGate`, inside `<Suspense>`, because pages re-render on
   navigation and layouts don't. Content outside the gate would enter the public static shell. A small client component refreshes the shell when
   a page finds that the role has changed.
4. **`cache()` shares the user within one render, and nothing longer.** `use cache: private`, which the bundled guide recommends, is rejected:
   it would hide a changed role or ended session for minutes, and would hold identity data in a browser cache.
5. **A session ends through `GET /api/auth/session-ended`, reached by a full navigation.** The route clears the cookie, as only a route handler
   can. It asks the API first, so a link to it can't sign someone out of a working session. A full navigation clears memory and hidden screens.
6. **The same-origin route removes page links** (`links`, `meta.links`, `meta.path`) from JSON bodies, as screens page by number. It returns `502` for
   a body that isn't JSON, which came from something in front of the API. It refuses requests that don't ask for JSON: a link opened from another site
   carries the cookie under `SameSite=Lax`, and could otherwise write a false "opened" entry in the audit trail.
7. **Forms holding credentials use `method="post"`, and their submit stays disabled until hydration.**
8. **One route table.** Navigation, guards, and the proxy read `lib/auth/app-routes.ts`. A catch-all route serves unbuilt entries and the framed
   not-found state, so later phases add a folder and flip one flag.
9. **Returning after sign-in skips pages that write an audit entry when opened,** so that nobody is recorded as opening a record because of where
   the previous person's session ended. The owner chose this.

## Alternatives

| Option | Why not |
|---|---|
| `prefetch={false}` on every link | Relies on memory, and still ran the read in other prefetch paths. It stays required on links to audited records, as a second layer |
| `redirect()` for an ended session | Can't clear the cookie, and can't change a response already streaming |
| Checking in the layout | Doesn't re-run on navigation, and doesn't stop nested content being rendered |
| Rewriting page links to same-origin ones | More code, and nothing would use them |
| Fifteen placeholder files | One table avoids them, and each would be replaced later anyway |

## Consequences

**Good:** a later page gets all of this by following one pattern. Prefetching can't cause API traffic or audit entries, whatever a future link does.

**Costs:**

- `server-api` must stay the only server path to the API, and everything on a page must stay inside the gate. Both are review items for each later
  phase, as nothing can enforce them automatically yet.
- Going back to a kept-mounted page makes no call, so it isn't re-checked until the next navigation or request. This is accepted, because the API
  remains the boundary, and it's also what audited pages need.
- With a session, an unknown address returns status 200, as its response has already started. No one sees the status, and the application isn't indexed.
- A production build's cookie is `Secure`, so over plain HTTP, the browser discards it and sign-in silently returns to the sign-in page. HTTPS is required
  for production anyway, and the README says so.

**Open:**

- `FilterBar` has no `method`, so it could submit by itself before hydration, putting a filter's value in the address. No screen uses it yet. **The
  phase that first uses it (Phase 4) must address this,** especially before any patient search uses it in Phase 5.
- A client cache added later must be cleared in `lib/auth/session-end.ts`. TanStack Query waits for its first consumer.
- The `Origin` check compares with `Host`, so a reverse proxy must pass `Host` on. This belongs to the deployment decision, Q6.
- The client's address isn't forwarded yet. Hazard H2 stays a production blocker.
