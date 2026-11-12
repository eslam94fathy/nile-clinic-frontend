# Architecture

> **Status: approved design.** Phase 1 built the foundation: locale routing, configuration, contracts, and tooling. Phase 2 built
> the design system: see [Design system](#design-system).
> Phase 3 built the BFF and authentication: see [Authentication and authorization](#authentication-and-authorization). Phase 4 built clinic setup. **TanStack
> Query isn't installed,** as nothing has needed it: see [ADR 0011](decisions/0011-server-reads-and-refresh.md). Decisions are recorded in [docs/decisions/](decisions/README.md).

## Overview

An internal staff application for administrators, receptionists, and doctors, in front of the
existing Laravel API. The browser never talks to Laravel and never holds the token: the Next.js
server sits between them as a Backend for Frontend (BFF).

```text
 Browser                         Next.js server                          Laravel API
 ┌───────────────────┐           ┌──────────────────────────┐            ┌───────────┐
 │ Server-rendered   │  HTML     │ Server Components        │  Bearer    │           │
 │ pages             │◄──────────│  └ serverApi()           │───────────►│  /api/v1  │
 │                   │           │                          │            │           │
 │ Client Components │  same-    │ /api/auth/*              │  Bearer    │           │
 │  └ TanStack Query │  origin   │  sign-in, sign-out       │───────────►│           │
 │                   │──────────►│ /api/backend/[...path]   │───────────►│           │
 │ HttpOnly session  │  cookie   │  adds token and locale   │            │           │
 │ cookie (unreadable│           │                          │            │           │
 │ by JavaScript)    │           │ Session secret, API URL  │            │           │
 └───────────────────┘           └──────────────────────────┘            └───────────┘
```

Why this shape: the API issues bearer tokens only, and the brief prohibits storing them where
JavaScript can read them. See [ADR 0001](decisions/0001-authentication-bff.md).

## Source layout

```text
src/
├── app/
│   ├── [locale]/
│   │   ├── (auth)/sign-in/            # public
│   │   └── (app)/                     # signed-in shell; loads the user, guards by role
│   │       ├── dashboard/
│   │       └── <feature routes>/      # see frontend-blueprint.md
│   └── api/
│       ├── auth/{sign-in,sign-out,session-ended}/   # sign-in is the only code that sees the raw token
│       └── backend/[...path]/         # same-origin proxy for Client Components
├── features/
│   └── <feature>/                     # auth, staff, patients, appointments, queue, billing, ...
│       ├── api/                       # typed calls for this feature; the only network code
│       ├── components/                # this feature's UI
│       ├── hooks/                     # query hooks, from Phase 7
│       ├── schemas/                   # Zod form schemas
│       └── types.ts                   # names over generated API types
├── components/
│   ├── ui/                            # shadcn/ui primitives
│   └── shared/                        # app-wide: DataTable, PageHeader, EmptyState, ...
├── lib/
│   ├── api/                           # server client, browser client, ApiError, generated types
│   ├── auth/                          # session handling (server-only), permissions map
│   ├── config/                        # validated environment
│   ├── format/                        # dates, times, money
│   └── i18n/                          # next-intl routing and request config
├── messages/{en,ar}.json
├── instrumentation.ts                 # validates configuration at startup
└── proxy.ts                           # locale routing and the early session redirect

contracts/                             # read-only snapshot of the backend's contracts
scripts/                               # contract tooling and project-specific checks
e2e/                                   # Playwright tests, and the fake backend
```

Folders appear only when first needed.

**Import rules**

| From | May import |
|---|---|
| `app/` | `features/`, `components/`, `lib/` |
| `features/x` | `components/`, `lib/`, and its own files. Other features only via a deliberate public export |
| `components/shared` | `components/ui`, `lib/format`; never `features/` |
| `lib/` | `lib/` only |

Server-only modules (`lib/auth/session`, the server API client, `lib/config`) use the `server-only`
package, so importing one into client code fails the build.

## Data flow

**Reading in a Server Component.** `serverApi()` reads the session cookie and calls Laravel directly.
Used for the shell, and for first loads where it helps. All such fetches are uncached (`no-store`), and each waits for `connection()`
first, so that a link's prefetch can't reach the API ([ADR 0010](decisions/0010-session-and-guards.md)).

**Changing data from a Client Component.** A form calls the feature's API module, which calls `/api/backend/...` on the same
origin. The proxy adds the bearer token and `Accept-Language`, then returns the status and body unchanged. The form then calls
`router.refresh()`, which also updates pages opened earlier and still mounted ([ADR 0011](decisions/0011-server-reads-and-refresh.md)).

**Showing a patient without opening them.** Appointment screens use `PatientChooser` and `ChosenPatient` from `features/patients`, which read
through the unaudited list, including `GET /patients?id=N` for one number. Reading the record there would write an opening nobody asked for.
Appointments themselves aren't audited, so they follow the server read and refresh above.

**A list that stays current.** The queue's lists, and Billing while it shows the clinic's today, read themselves every 15 seconds while on screen, through `useLiveList` in `lib/api`, over TanStack Query, with the `live` policy in `lib/api/live-query.ts` and `LiveQueryProvider` from `components/shared/live` only on those pages ([ADR 0013](decisions/0013-live-reads.md), [ADR 0015](decisions/0015-live-reads-beyond-the-queue.md)). Billing for any other date uses the `onDemand` policy, which reads when opened, after an action, and on "Refresh", and never by itself. Each feature passes its own root key, so its actions refresh only its own lists. **Only reads the backend doesn't audit may do this.** Measured: nothing is read while a tab is hidden, or while the person is on another page and the list is kept mounted. Actions keep the project's own pattern, and refresh the lists afterwards. A failed read keeps the last list with a notice, and a `403` or `404` clears it and stops.

**A money action is sent once.** The backend has no idempotency key (hazard H6), so a resent payment can be recorded twice. Every
money action allows one request at a time and is never retried. When no usable answer arrives, the page reads the charge again and
asks the person to check its payments before trying again. Amounts stay text from the API to the screen, and typed amounts are checked
and compared on their digits by `lib/format/amount.ts`. Charges and a charge's page read on the server and refresh after each action,
under ADR 0011.

**Reports show the API's figures and nothing else.** The four reports in `features/reports` read in the browser under the `onDemand`
policy, inside their own `LiveQueryProvider` with the root key `["reports"]` ([ADR 0016](decisions/0016-reports-read-on-demand.md)): when
opened, when a choice or page changes, and on "Refresh", so a failed reread keeps the figures with a notice. None is audited. The period
and doctor live in the address and are shared by the four through their tabs; a period the API would refuse isn't read at all, because the
component that reads isn't mounted. No figure is added up, rounded, or averaged here, and a `null` average or rate reads "Not available".
The one chart, net money by day, is HTML and CSS sized from exact whole piastres (`toPiastres`), beside a table of the same figures, with
no library ([ADR 0017](decisions/0017-charts-without-a-library.md)).

**Dashboards are panels, each read on its own** ([ADR 0019](decisions/0019-dashboards-read-in-panels.md)). `/dashboard` shows the
signed-in role's dashboard from `features/dashboard`, inside its own `LiveQueryProvider`. Each panel is one `useLiveList` whose read
makes its few requests together and fails as one, with its own key as its refresh's, so Refresh and Try again read only that panel,
and one panel's failure leaves the others. A figure is `meta.total` from a read with `per_page=1`; a short list is five rows. The
receptionist's and the doctor's panels read live; the administrator's on demand. Today is worked out when each read runs, so a page
left open past midnight reads the new day. The dashboard reads through its own module with narrow schemas that drop what it doesn't
show, such as a listed patient's phone, and **no audited read is ever made**: no row links to a patient's record or a medical
record.

**A confirmation sits above anything a refresh can remove.** The queue's dialogs hold their own copy of what they're about, because a refresh could otherwise close one under someone, or change what it says.

**Proxy rules**

- Forwards only to the configured `/api/v1` base; rejects `..` and encoded traversal.
- Refuses `auth/sign-in`, so a token-bearing response can't reach the browser by this route, and `auth/sign-out`, which must also clear the cookie.
- Removes page links from lists, because they hold Laravel's address.
- Doesn't forward browser cookies to Laravel.
- Checks `Origin` on state-changing methods. This, with `SameSite=Lax`, is the CSRF defense.
- Sets `Cache-Control: no-store` on responses.
- Logs no bodies, and no query strings, because search filters can hold patient details.

**Query policy** (full detail in [ADR 0005](decisions/0005-audit-safe-data-fetching.md))

| Kind | Examples | Behavior |
|---|---|---|
| Live | Queue, Billing for today, the desk's and doctors' dashboards | Polls only while the tab and the page are visible |
| Normal | Lists, reference data | Not a query: read on the server, then refresh ([ADR 0011](decisions/0011-server-reads-and-refresh.md)) |
| Audited | Patient, encounter, history, audit search | No automatic refetch, no retry, no link prefetch ([ADR 0012](decisions/0012-audited-reads-in-the-browser.md), [ADR 0018](decisions/0018-audit-search-on-press.md)) |

The query cache is memory only, is never persisted, and is cleared at sign-out and on `401`, both of which load a whole new page.

**Patient reads** are the exception to server reads ([ADR 0012](decisions/0012-audited-reads-in-the-browser.md)). Records and patient search run in Client Components through the same-origin route, and no patient API call exists on the server. A server read of a record writes a false "opened" entry after a refresh and the back button, and search terms can't reach the server without entering the address. Everything else reads on the server, under [ADR 0011](decisions/0011-server-reads-and-refresh.md).

**Medical records** follow the same rule, more strictly ([ADR 0014](decisions/0014-writing-medical-records.md)). Clinical content is only ever in a Client Component's state: never read on the server, never in the query cache, sent `no-store`, and gone at sign-out's full page load. A record or a history uses the guarded read, `useAuditedRead` in `lib`, which patients use too. In the panel beside a draft, each read runs directly in a click's handler, so nothing can repeat it. "My visits" holds no clinical content, so it reads on the server like other lists, and "My queue" reads the same list live for record statuses.

**The audit log** reads only inside a person's press ([ADR 0018](decisions/0018-audit-search-on-press.md)). Every request to `GET /audit-entries`, each page included, writes a permanent `audit.searched` entry, so `useAuditSearch` in `features/audit` makes one only from Search, Older, Newer, Try again, or Start again, once per press, with a ref set before the request. No effect reads, nothing is cached, and the page's address never holds a query, so a reload, a link, or the back button can't repeat a search. The results and the filters sent stay in the component's state, so going back from a linked page shows them again without a read. Paging uses the API's cursors through `CursorPager`, which lives in the audit feature as its only user (Phase 13), sending the filters of the page shown. The staff choice is read on the server, as it isn't audited. A patient's number links only through `PatientLink`.

**Text that's only on screen.** A draft exists only in the page until a doctor saves it, as nothing saves by itself and nothing is kept in the browser. So `UnsavedChangesGuard` warns on every way out it can catch: links, in one place, sign-out, closing, and back and forward through the Navigation API. A `401` on a change is answered rather than acted on, a `403` or `404` doesn't re-decide the page, and fields go read-only during a request. A deliberate sign-out in any tab still leaves at once.

## Authentication and authorization

```text
Sign-in form → POST /api/auth/sign-in → Laravel POST /auth/sign-in
                                     ← token sealed into an HttpOnly cookie
                                     ← browser receives only the user object

proxy.ts          No cookie? Redirect to sign-in. Optimistic only; never a security decision.
(app)/layout      Static frame. The shell streams in, showing the user and role's navigation.
ScreenGate        In each page: GET /auth/me, shared within a render. Role can't use this page → "not allowed" state.
Components        <Can> hides what this role can't do.
Laravel           The real decision, on every request.
```

A single `lib/auth/permissions.ts` holds the capability map, transcribed from the backend's policies
([matrix](backend-integration.md#permission-matrix)). Tests compare the map with the matrix.

**Session end.** Any `401` does a full navigation through `/api/auth/session-ended`, which clears the cookie, as a Server Component can't, and sends
the person to sign-in with a safe, same-origin return path. Pages that write an audit entry when opened aren't returned to. Other tabs follow through a
`BroadcastChannel`. Sign-out calls Laravel, then always clears the cookie, even if the call fails. A page writing a medical record is the one exception to leaving at once, when nobody chose the ending and text would be lost ([ADR 0014](decisions/0014-writing-medical-records.md)).

**Header.** It can't go in the root layout, because a catch-all route can't prerender the language switch. Public pages use `PublicHeader`, and the
signed-in top bar sits inside the shell's `<Suspense>`.

The cookie is `HttpOnly`, `Secure` in production, `SameSite=Lax`, and sealed. It ends with the browser. Its lifetime is not the
source of truth: Laravel's idle timeout is. Since Phase 13 the seal also holds the signed-in person's id and email, read only by unlocking.

**Inactivity lock.** The record page and the patient history page are wrapped in `InactivityLock` (`features/auth`). After 5 minutes
without keyboard, pointer, wheel, touch, or scroll activity, it opens a native modal dialog appended to the body, and hides everything
else; the page stays mounted underneath, so nothing typed is lost and nothing is sent. `POST /api/auth/unlock` takes only the password,
signs in with the sealed email, checks the sealed id, ends the old token, and seals the new one. Signing out from the lock warns first
([ADR 0020](decisions/0020-inactivity-lock.md)).

**Security headers.** `next.config.ts` sends the headers in `lib/security/headers.ts` on every response: a policy that allows scripts only
from this site and inline (no hash or nonce can cover the streamed ones while pages stay prerendered), and closes connections, images,
fonts, forms, framing, and plugins to everything else, with `nosniff`, `same-origin` referrers, and a permissions policy. The reverse proxy
sets `Strict-Transport-Security` ([ADR 0021](decisions/0021-security-headers.md)).

## Internationalization and direction

URL-prefixed locales, `/en/...` and `/ar/...`, with next-intl. See
[ADR 0003](decisions/0003-i18n-routing.md).

- next-intl's detection is off, because it also reads the browser's language. `proxy.ts` redirects any address whose first
  segment isn't exactly a supported locale to the saved choice, otherwise Arabic.
- The choice is saved when someone uses the language switch: next-intl's `Link` writes the cookie.
- **Never re-create the request in `proxy.ts`.** Doing so made localized pages return 404 intermittently in production.

- `<html lang dir>` is set from the locale in the root layout.
- Layout uses logical utilities only (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`).
- Client calls send the locale, and server code passes it as `Accept-Language`.
- Backend messages are shown as sent, so they already match the active language.

## Rendering

[Cache Components](decisions/0006-cache-components.md) are on. Pages are prerendered as a static shell holding `<html lang dir>`
and static text, and dynamic content streams into `<Suspense>` boundaries. Consequences found by testing:

- Without JavaScript, streamed content doesn't replace its fallback, and not-found pages are blank. The sign-in page has a
  `<noscript>` notice, and its submit stays disabled, so a form can't send a password by itself. This is acceptable for an internal application.
- `next build` needs no runtime configuration and doesn't contact the backend.
- The static shell can't know the query string, so the language switch gains it only after JavaScript runs. A click in that
  brief moment still changes language and keeps the page, but drops the query. This is accepted: nothing is lost that the
  person can't re-enter, and fixing it would make every page dynamic.

## Design system

Tokens live in `app/globals.css`. Shared parts live in `components/shared` over generated `components/ui`.
See [ADR 0007](decisions/0007-design-system-foundation.md) and [ADR 0008](decisions/0008-visual-direction.md).

- **Themes.** A fixed inline script sets `data-theme` before first paint. A layout effect re-applies it, because a language switch
  swaps the root layout and the script doesn't run again. Reading a cookie on the server would make every page dynamic.
- **Fonts.** `next/font/local` over pinned packages, with `adjustFontFallback: false`, or Arabic text stops at the Latin font's fallback.
- **Preview.** `/{locale}/design-preview` has two gates, as neither is enough alone. `proxy.ts` gives the `404`, and a check at request
  time inside `<Suspense>` keeps its content out of prerendered files. Its text and data stay on the server, so they never reach
  client bundles. It's off unless `DESIGN_PREVIEW_ENABLED=true`.

## Configuration

Settings are read only on the server (`lib/config/env.ts`, guarded by `server-only`). `instrumentation.ts` validates them when
the server starts, in the standalone server and `next dev`, and exits with a message naming the setting, never its value.

## Deployment

`output: "standalone"`: the Docker image runs `node server.js` behind a reverse proxy that terminates HTTPS, on the backend's Compose
network, and the tests run the same server. `callBackend` passes the incoming `X-Forwarded-For` on unchanged, for the backend to trust once
it's configured to (hazard H2). `GET /api/health` reports only that the frontend serves. See [docs/deployment.md](deployment.md) and
[ADR 0022](decisions/0022-deployment.md).

## Clinic time

`lib/format` is the only place that formats dates, times, or money. Instants use the configured clinic
time zone, not the browser's. "Today" for default filters is computed in that zone as a convenience
only; the API remains the authority on what today is.

## Testing strategy

| Layer | Tool | Covers |
|---|---|---|
| Logic | Vitest | Formatting, error mapping, permissions map, proxy path rules |
| Components | Vitest + Testing Library | Every state, form error mapping, RTL rendering |
| End to end | Playwright against the real Docker API with synthetic data | Critical journeys per role, both locales, role refusals |

## Error handling

A single `ApiError` carries status, `message`, field `errors`, and `reason`. One helper maps its field
errors onto React Hook Form. `error.tsx` and `not-found.tsx` handle the route level, and a shared view
handles `401`, `403`, `404`, and doctor-without-profile as described in
[backend-integration.md](backend-integration.md#errors).
