# Research: Authentication and App Shell

The design was tested on 2026-11-06 with a throwaway production build (`next build` and `next start`), driven by Playwright in Chromium against
the real Docker backend at commit `dff2dca`, using synthetic accounts. The spike's code isn't kept. Results below are what was observed,
unless marked otherwise.

## R1. Pagination on the live API

**Observed**, on `/staff`, `/doctors`, `/patients`, and `/fees`:

- Top level: `data`, `links`, `meta`.
- `meta`: `current_page`, `from`, `last_page`, `links`, `path`, `per_page`, `to`, `total`. `total` is a number.
- `links`: `first`, `last`, `prev`, `next`.
- `per_page=101` gives `422`. `/specialties` has `data` only.

**Decision**: The confirmed type holds `current_page`, `from`, `last_page`, `per_page`, `to`, and `total`. `DataTablePagination` (`page`, `lastPage`, `total`) maps onto these with no change. Whether `from` and `to` are `null` on an empty page is checked during implementation, before the type is final.

## R2. Page links expose the private address

**Observed**: `links.*`, `meta.links[].url`, and `meta.path` hold absolute Laravel addresses, such as `http://localhost:8080/api/v1/staff?per_page=1&page=2`. They repeat the request's query string, which can hold search terms.

ADR 0001 says that the Laravel address stays private, and that was tested only for `/health`. A route returning bodies unchanged would break it on every list. `meta.links[].label` is also untranslated English.

**Decision**: The same-origin route removes top-level `links`, `meta.links`, and `meta.path` from JSON bodies. Screens page by number, using `meta`. The spec's FR-006 was amended.

**Alternatives**: Rewriting addresses to same-origin ones (nothing would use them, and it's more code). Leaving them (breaks ADR 0001).

## R3. Prefetching runs cookie-based reads

**Observed**, with three visible default links: one full page load made **4** identity calls. With `prefetch={false}` it made 2, and the server logged `Date.now()` "while prerendering" errors from the session library's unseal step. With `await connection()` before reading the session, and default links: **1 call per load, 1 per soft navigation, 0 from prefetch, and no errors**.

The bundled guides agree: a link's App Shell "holds its static and session output". So ADR 0006's rule 3, that partial prefetching "doesn't run dynamic reads", is wrong for anything that reads cookies, and its reasoning needs correcting.

Why it matters beyond the wasted calls: each one restarts the API's 8-hour idle timer, and a list of links on a later page could read data the person never opened. A cookie-based audited read without `prefetch={false}` could write a false entry.

**Decision**: `server-api` calls `await connection()` before anything else, and is the only server path to the API. `prefetch={false}` stays required on links to audited records, as a second layer. Default prefetch is otherwise fine, as it now fetches only static output.

**Alternatives**: `prefetch={false}` on every link (relies on memory, and still logs the errors). `use cache: private` (rejected in R4). The `prefetch()` stage function (documented, but `connection()` is simpler and already used in this repository).

## R4. `use cache: private` is rejected

The bundled authentication guide recommends it for reading the user. It keeps results in the browser with a five-minute default lifetime. That would let a changed role or ended session go unnoticed for minutes, and would hold identity data in a browser cache. FR-005 forbids it, and ADR 0006's rule 1 covers it in spirit.

## R5. Where checks live

The bundled guide warns that layouts don't re-render on navigation, so a layout's navigation would keep showing an old role. The spike went straight to the fix below, so the stale state itself wasn't observed.

**Decision**:

- Every page wraps all its content in a gate, inside `<Suspense>`, which reads the current user. React `cache()` shares that one read with the shell in a single render (R3's count of 1 confirms it).
- When the gate's role differs from the shell's, a small client component calls `router.refresh()`. **Observed**: after a role change and a soft navigation, the shell's navigation showed the new role.
- **Observed**: on the not-allowed response, both the HTML and the RSC payload lacked the page's content.

Going back to a kept-mounted page made 0 calls. So that view is not re-checked until the next navigation or request. This is accepted, because the API remains the boundary, and it's also what audited pages need.

## R6. How a session ends

A Server Component can't clear a cookie. Calling `redirect()` after streaming starts can't change the response, either.

**Decision**: When a read finds `401` or no session, the gate renders a client component that does a full `location.replace` to `GET /api/auth/session-ended`. That route clears the cookie and sends the person to sign-in, with the message. Full navigation is what clears memory and hidden screens (ADR 0006's rule 5).

**Observed**:

- After an administrator set a new password, a soft navigation reached sign-in, with the cookie gone.
- With a valid session, the route doesn't clear anything and goes to the landing page. So a link to it can't sign someone out, because it asks the API first.
- A tampered cookie shows no content.
- The old cookie, sent again after sign-out, shows no content.

## R7. The session cookie

iron-session 9.0.1, `cookieOptions: { maxAge: undefined }`.

**Observed** in Chromium: `HttpOnly`, `Secure`, `SameSite=Lax`, no expiry (it ends with the browser), 316 characters. `Secure` works on `localhost` under `next start`. The sealed value sent directly to the API as a bearer token gets `401`. The sign-in response held only the user. `document.cookie` didn't show it.

Setting `maxAge: undefined` makes the library use a seal lifetime of 0, meaning no expiry of its own. This is what FR-004 needs: a fixed seal lifetime would end a working session while the API still considered it valid.

## R8. Addresses with no session

**Observed**:

- A known signed-in address redirects to sign-in with a return address (`307`).
- An unknown one, rewritten to a public page that calls `notFound()`, keeps its real `404`, which is what `routing.spec.ts` and `design-preview-gate.spec.ts` already require.
- With a session, an unknown address shows the framed not-found state with status **200**, because that response has already started streaming. The bundled docs describe this too. It's accepted, since no one sees the status and the application isn't indexed.
- The static not-found response carries `s-maxage=31536000`. It holds no personal data, but a shared cache in front of the application could serve it for an address a signed-in person would see differently. That's recorded for the deployment decision (Q6). Signed-in pages are `private, no-cache, no-store` without extra configuration.

**Also found**: a catch-all route can't prerender a client `usePathname()`, so `next build` fails on the language switch in the root layout. **Decision**: the header moves into the route groups, and the signed-in top bar sits inside the shell's `<Suspense>`.

## R9. Forwarding the client's address

**Decision**: Not sent in this phase. Laravel trusts no proxies yet, so a header would have no effect. The right value depends on the deployment (Q6), and forwarding what a client sent would let it forge its audit address once the backend does trust the header. All backend calls pass through `server-api` or the two auth routes, so adding it is a small, contained change with the backend work. H2 stays a production blocker.

## R10. Dependencies

| Package | Decision | Reason |
|---|---|---|
| `iron-session` 9.0.1 | Add | ADR 0001. Tested above |
| `react-hook-form` 7.91.0, `@hookform/resolvers` 7.0.3 | Add | Two forms, and the guidelines require them. Installed cleanly with Zod 4; the types are confirmed by the first form |
| `@tanstack/react-query` | **Don't add** | Nothing here queries from the client: identity loads on the server, and the password change is a single request. Principle IX. The roadmap's "Phase 3" becomes its first consumer's phase. ADR 0005's rules apply from then. Full navigation clears memory, so nothing about sign-out has to change |
| `msw` | **Don't add** | ADR-era question for this phase. A stubbed `fetch` covers component tests, and the fake backend covers end to end |

## R11. Origin check

**Decision**: State-changing methods on all BFF routes need an `Origin` header whose host equals the request's `Host`. A missing `Origin` is refused. This includes sign-in, which stops a cross-site form signing someone into another account. How a future reverse proxy passes `Host` belongs to Q6, and is recorded for Phase 13. **Not yet observed**; tested in this phase.

## R12. Other notes

- **Local data**: the development database already held 90 staff accounts, so nothing can assume an empty list. One synthetic administrator, `synthetic.admin@example.test`, was added for the spike through the backend's own command, and is reused for live tests. Spike receptionist accounts are deactivated, as there's no delete.
- **Port**: the backend answers on 8080 on this machine today, and `.env.local` agrees. `CLAUDE.md` and `backend-integration.md` say 8081, so they get corrected.
- **Incoming request logging**: `next dev` logs request addresses, including query strings. `logging: { incomingRequests: false }` turns this off, as the constitution requires. `next start` doesn't log them.
- **Doctor accounts for tests**: `POST /doctors` needs `user_id`, `title`, and `specialty_ids`, so live setup creates a specialty as well.
