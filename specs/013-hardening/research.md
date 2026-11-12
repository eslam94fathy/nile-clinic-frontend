# Research: Hardening and Production Readiness

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-11-11

Backend checked at commit `dff2dca` (contracts copied in `contracts/`, source at the local checkout). Next.js 16.4.5's bundled
docs read from `node_modules/next/dist/docs/`.

## Facts found

| # | Fact | Evidence |
|---|---|---|
| F1 | A production page carries about a dozen inline scripts written at request time: `self.__next_f.push([...])` holding that request's data, React's `$RC`/`$RS`/`$RB` streaming helpers, a Turbopack bootstrap, and the theme script | `next start` of the existing build, `GET /ar/sign-in`, 2026-11-11: 12 inline `<script>` elements, 3 of them `__next_f` payloads |
| F2 | The prerendered shell (`.next/server/app/ar/dashboard.html`) already holds two inline scripts, built before any request | Same build; responses carry `x-nextjs-prerender: 1` and `x-nextjs-postponed: 1` |
| F3 | Nonces "require dynamic rendering", and "Partial Prerendering (PPR) is incompatible with nonce-based CSP since static shell scripts won't have access to the nonce" | `01-app/02-guides/content-security-policy.md`, "Static vs Dynamic Rendering with CSP" |
| F4 | Experimental SRI hashes script **files** at build time and "cannot handle dynamically generated scripts" | Same guide, "Subresource Integrity (Experimental)" |
| F5 | Page responses already send `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`; every route handler sends `no-store` | Same `next start`; `src/app/api/**/route.ts` |
| F6 | The only raw HTML in the application is the theme script; 6 components set `style={{…}}` | `grep dangerouslySetInnerHTML`, `grep "style={{"` over `src` |
| F7 | `POST /auth/sign-in` takes `{email, password}`; wrong credentials, a deactivated account, and throttling are all `422` with a translated message; limits are 5 failures per email and 20 attempts per client address per 60 s | `contracts/staff-auth.openapi.yaml` |
| F8 | There is no endpoint that checks a password without signing in | Same contract: only `sign-in`, `sign-out`, `me`, `password` |
| F9 | `auth.sign_in` and `auth.sign_out` are audit actions | `contracts/audit.openapi.yaml`, action enum |
| F10 | The sealed cookie holds only the token; the user is read from `/auth/me` per request | `src/lib/auth/session.ts` |
| F11 | `callBackend` sends no client address; the backend configures no trusted proxies and uses `request()->ip()` for audit addresses and the sign-in limit | `src/lib/api/server-api.ts`; backend `bootstrap/app.php` has no `trustProxies`, `AuditTrail.php:109`, `AuthController.php:28` |
| F12 | State-changing BFF routes compare `Origin`'s host with `Host` | `src/lib/auth/origin-check.ts` |
| F13 | Without `output: "standalone"`, a container needs the whole `node_modules`; standalone copies only what the server needs, but not `public` or `.next/static` | `03-api-reference/05-config/01-next-config-js/output.md` |
| F14 | Behind nginx, streaming needs buffering off; Cache Components works on a self-hosted Node server and in Docker | `02-guides/self-hosting.md` |
| F15 | The backend's Compose project runs `nile-clinic-web-1` (nginx, port 80 inside, `127.0.0.1:8080` outside) and `nile-clinic-app-1` (PHP-FPM) | `docker ps`, 2026-11-11 |
| F16 | Saving a draft shows a persistent "saved at" status; an addendum appears in the list; finalizing changes the page. Success toasts are extra | `encounter-form.tsx:166,225`, `addenda.tsx:71` |
| F17 | Real consumers (outside the design preview): `CursorPager` 1 (audit); the "not available yet" `Placeholder` 0, as every navigation entry is `built: true`. The other single-consumer shared files are the app-wide frame (logo, language and theme switches, theme script and sync, notices), not reusable abstractions | Consumer count over `src`, 2026-11-11; `src/lib/auth/app-routes.ts` |
| F18 | The live suite already has journeys for clinic setup (both locales), patients, appointments, queue, encounters, billing, reports, audit, and dashboards, each within one or two roles | `e2e/live/*.spec.ts` |
| F19 | The live suite already captures the server's output and searches it for synthetic patient details | `playwright.live.config.ts` (`serverLog`) |

## R1. How the content security policy treats scripts

**Decision**: A static policy sent on every response: `script-src 'self' 'unsafe-inline'`, with every other directive strict (see
[security-headers](contracts/security-headers.md)). No nonce, no hash. A lint rule makes the theme script the only raw HTML allowed. Owner's
choice, 2026-11-11 (spec, Clarifications).

**Rationale**: F1–F4. Every page streams inline scripts that carry request data, so no build-time hash can match them, and the shell's
inline scripts exist before any request, so no nonce can reach them. Allowing inline scripts keeps prerendering ([ADR 0006](../../docs/decisions/0006-cache-components.md)).
The rest of the policy still does real work: an injected script can't load code from elsewhere (`script-src 'self'`), can't send data to
another site by `fetch`, image, font, or form (`connect-src`, `img-src`, `font-src`, `form-action`), can't change where relative addresses
point (`base-uri 'none'`), and the page can't be framed (`frame-ancestors 'none'`). React escapes everything it renders, and nothing
renders backend text as HTML (F6).

**Alternatives considered**:
- *Nonce with `strict-dynamic`*: strongest, but every page renders per request, reversing ADR 0006, and the proxy would have to pass on a
  modified request, close to what made localized pages return 404 in Phase 1 (research R2 there). Rejected by the owner.
- *Hash of the theme script*: once any hash is present, browsers ignore `'unsafe-inline'`, so the streamed scripts would be blocked (F1).
- *Experimental SRI*: covers script files only (F4); the inline problem remains, and it is experimental.

**Found while implementing** (task T007): Zod 4 probes once for `eval` with `Function("")`, which the policy blocks and the browser
reports. `src/instrumentation-client.ts` sets `z.config({ jitless: true })`, which skips the probe; Zod would take that path anyway.

## R2. The other headers, and who sets them

**Decision**: The application sets every header except strict transport security, through `headers()` in `next.config.ts` for all paths
(pages, route handlers, static files). The reverse proxy sets `Strict-Transport-Security` and nothing else. Full list in
[security-headers](contracts/security-headers.md).

**Rationale**: Headers kept in the repository are tested by `pnpm check` on every change, whatever proxy is used. Strict transport security
belongs where HTTPS ends: the application is reached over plain HTTP inside the host, and in tests, where that header would be wrong.
`upgrade-insecure-requests` is left out for the same reason; the proxy redirects HTTP to HTTPS instead.

**Alternatives considered**: All headers at the proxy (untested by the repository, lost if the proxy is replaced); setting headers in
`proxy.ts` (it doesn't run for `/api` and static files, and must never re-create the request).

## R3. Unlocking through a fresh sign-in

**Decision**: A new route, `POST /api/auth/unlock`, takes only the password ([contract](contracts/unlock-route.md)). The sealed cookie
gains the signed-in person's id and email at sign-in. The route signs in with the **sealed** email, checks that the returned account has
the **sealed** id, ends the previous token if it still exists, and seals the new token. A cookie sealed before this change has no email,
so it can't unlock, and the lock offers only signing out.

**Rationale**: F7–F10. The backend has no password check apart from signing in. Taking the email from the seal, not the browser, means the
lock can only ever sign in the person it belongs to: nobody can type another account's email into it, and no sign-in for another account is
ever attempted. The id check covers an email reassigned to another account while the page was locked. Unlocking still works after the old
token expired, because it doesn't use it. Ending the old token keeps one live token per person and tab group; the backend records
`auth.sign_in` and `auth.sign_out` (F9), which the owner accepted with this design.

**Alternatives considered**:
- *Email from the browser*: lets anyone at the screen attempt a sign-in for any account from a locked page.
- *Read the email from `/auth/me` with the old token*: fails exactly when it's most needed, after the backend's idle timeout.
- *Keep the old token*: two live tokens for one person, and the old one remains usable until its idle limit.

## R4. How the lock covers the page and keeps its text

**Decision**: `InactivityLock` wraps the page content. When locked it:

1. Opens a native `<dialog>` with `showModal()`. The browser puts it in the top layer, above every portal (including an open Radix
   confirmation), and makes the whole rest of the document inert: no pointer, no focus, nothing in the accessibility tree.
2. Gives the dialog an opaque backdrop covering the whole viewport, the shell included, as the lock offers its own sign-out.
3. Marks the wrapped content `invisible` as well, so nothing is painted even if the backdrop were to fail.

The content stays mounted, so form state, unsaved text, open dialogs, and requests in flight are untouched (FR-003, FR-008). Escape is
prevented from closing the dialog. On unlock, the dialog closes and focus returns to the element that had it.

Activity is `keydown`, `pointerdown`, `pointermove`, `wheel`, `touchstart`, and `scroll` (captured) on the document, recorded as
`Date.now()` in a ref. One timer is scheduled for the moment the limit falls due and re-scheduled on activity, at most once a second. On
`visibilitychange` to visible, and when a hidden page is shown again (its effects re-run), the elapsed time is checked in a layout effect, so
an expired page locks before it paints. `Date.now()` is used rather than timers alone because timers are throttled in hidden tabs and stop
while a computer sleeps.

**Rationale**: A native modal dialog gives inertness and top-layer stacking from the browser, which is harder to get wrong than z-index and
manual `inert` on every portal. Keeping content mounted is the only way to keep unsaved text without storing it, which the constitution
forbids. Outcomes of a request finished while locked stay visible on the page (F16); a success toast may expire unseen, and that's accepted.

**To verify in implementation** (a spike before building on it): with the finalize confirmation open, Radix's focus scope doesn't fight
the modal dialog for focus. If it does, the lock closes nothing, but moves focus into itself and stops Radix's trap while locked.

**Found while implementing** (tasks T002, T020): focus was fine, as Radix only refocuses its own, now inert, content. But Radix listens for
Escape on the document, so the lock stops Escape on `window` first; an open Radix dialog marks the rest of the body `aria-hidden` and
turns off its pointer events, so the lock renders into a new node appended to the body as it locks; and a portalled dialog stays painted
under the lock, so while locked every other child of the body is `visibility: hidden` (`body[data-locked]` in `globals.css`). The
confirmation sign-out step lives inside the lock, as a Radix dialog opened from it would be inert.

**Alternatives considered**: An overlay `div` with `z-index` (doesn't cover the top layer, and needs `inert` everywhere by hand); unmounting
the content (loses the text); blur (content still readable and announced).

## R5. Passing on the client's address (H2)

**Decision**: `callBackend` forwards the incoming `X-Forwarded-For` header unchanged when one is present, read from the request in route
handlers and in server rendering. The deployment requires the reverse proxy to **replace** that header with the connecting address
(`header_up X-Forwarded-For {remote_host}` in Caddy, `proxy_set_header X-Forwarded-For $remote_addr` in nginx), and the application's port
to be published only to the proxy. The backend request asks for `trustProxies` to name the application container's address.

**Rationale**: F11. A trusted-proxy setting on the backend alone isn't enough: the backend would then trust a header the frontend never
sends. Replacing rather than appending at the proxy means a browser can't put its own value first. Without the backend change, the backend
ignores the header, so this is safe to ship before it.

**Alternatives considered**: A setting to switch forwarding on (one more thing to misconfigure, for no gain, as the backend decides whether
to trust it); `X-Real-IP` (Laravel's trusted proxies read `X-Forwarded-For`).

## R6. The container image and the reverse proxy

**Decision**: `output: "standalone"` in `next.config.ts`. A multi-stage `Dockerfile` on `node:24-alpine`, pinned by version: install with
the pinned pnpm through Corepack, build, then copy `.next/standalone`, `.next/static`, and `public` into a runtime stage that runs
`node server.js` as the unprivileged `node` user. No setting is baked in: the build needs none (to verify in implementation), and every
setting is read at start. An example in `deploy/`: `compose.yaml` running the image and Caddy, joined to the backend's Compose network, with
a `Caddyfile` that terminates HTTPS, sets `Strict-Transport-Security`, replaces `X-Forwarded-For`, and passes `Host` unchanged (F12). The
documentation gives the nginx equivalents, including `proxy_buffering off` (F14).

**Rationale**: F13. Standalone keeps the image small and free of build tools and dev dependencies. Caddy streams without extra settings and
can issue a local certificate (`tls internal`) for testing HTTPS on one machine. The backend address inside the network is
`http://web/api/v1` (F15).

**To verify in implementation**: `next build` with standalone on Windows, as `pnpm check` builds locally (the docs note symlink limits). With standalone on, `next start` warns that it doesn't work with that output, so both Playwright configs run `node .next/standalone/server.js` instead, and every browser test then exercises the server the image ships.

**Alternatives considered**: `next start` with full `node_modules` (larger image, dev dependencies present); nginx as the example (needs
buffering and certificate set up by hand; documented as the alternative instead).

## R7. Health check

**Decision**: `GET /api/health` returns `200` with `{"status":"ok"}` and `Cache-Control: no-store`, reads nothing, and calls nothing.
The image's `HEALTHCHECK` runs it with Node's `fetch`, as the Alpine image has no `curl`.

**Rationale**: Owner's choice (frontend only). Under `/api`, so the proxy's locale redirect never touches it. The System status page still
shows the backend's state.

## R8. The journey suite

**Decision**: A new `e2e/live/journeys.spec.ts`, one test per locale, running the whole day across all three roles in order, on fresh
synthetic records with unique names: administrator sets up a doctor until bookable, with a fee; receptionist registers a patient, books,
checks in, then later charges and takes payment; doctor calls the patient, writes, saves, finalizes, adds an addendum, and finishes;
administrator finds the visit's money in a report and the record's opening in the audit trail, with the expected count. Cross-role refusals
are covered by an extra test per role. The existing specs stay as they are (F18).

**Rationale**: Existing specs prove each module and stop at their own role; only the hand-offs are missing. Reusing the live suite's setup,
teardown, and server-log check (F19) costs nothing new. It runs before each release (documented).

## R9. Accessibility coverage

**Decision**: Extend `e2e/accessibility.spec.ts` to visit every page in `app-routes`, as its permitted role, in both locales and both
themes, with the lock shown on a record page, using the fake backend. A by-hand checklist in [quickstart](quickstart.md) (keyboard-only
journey, screen reader on the lock and a record, 200% and 400% zoom, reduced motion, RTL reading order) is completed by the owner.

**Rationale**: Per-phase checks covered each phase's screens; one sweep over every route catches the shared frame and anything missed.
WCAG 2.2 checks that axe can't make (focus not obscured, target size in context, dragging) are on the by-hand list.

## R10. Measuring speed without a dependency

**Decision**: A Playwright script, `e2e/live/performance.spec.ts`, against the production build and the live API, opening each role's main
screens 8 times each and reading the browser's own `largest-contentful-paint` and `event` (Event Timing) entries through
`PerformanceObserver`. It records the 75th percentile per screen in its output and fails over the targets (2.5 s, 200 ms). Results are
copied into `tasks.md`.

**Rationale**: The browser already measures both. `web-vitals` or Lighthouse would add dependencies for the same numbers. Main screens:
dashboard (each role), patients search, appointments, queue, billing, a record, reports, audit.

## R11. Clean-up

**Decision**: Remove `Placeholder`, the `built` flag in `app-routes`, and the `shell.placeholder*` keys; the catch-all route stays, for the
framed not-found state. Move `CursorPager` and its test into `features/audit/components/` (the preview never showed it). Keep the app-wide
frame components where they are (F17), and record why.

**Rationale**: The Phase 2 limit (its plan, Complexity Tracking) applies to reusable components, not the one shell. A pager used by one
feature is that feature's code (principle IV).

## R12. The security review

**Decision**: Three passes, each recorded in `review.md` with every finding and its outcome: `/security-review` over the whole branch
history since Phase 1, a by-hand threat walk-through of the BFF routes (origin checks, path traversal, token handling, unlock), and
`pnpm audit --prod` for known vulnerabilities in dependencies. Token absence (`e2e/token-absence.spec.ts`) is extended to the unlock route's
response and the lock's page.

## R13. What production writes to its output

**Decision**: Keep the console as the only channel (owner's choice). Confirm by test that the server's output, during the whole journey
suite, holds no synthetic patient detail, clinical text, token, or query string, extending the existing check (F19) with clinical text and
query strings. Document `docker logs` and Docker's log rotation (`max-size`, `max-file`) in the deployment guide.
