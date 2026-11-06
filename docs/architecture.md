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
│   └── <feature>/                     # auth, staff, patients, appointments, queue, ...
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

**Reading in a Client Component.** Planned for the queue's polling in Phase 7, with a feature hook over TanStack Query. Nothing does this yet.

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
| Live | Queue | Polls only while the tab is visible |
| Normal | Lists, reference data | Standard stale times |
| Audited | Patient, encounter, history, audit search | No automatic refetch, no retry, no link prefetch |

The query cache is memory only, is never persisted, and is cleared at sign-out and on `401`.

**Patient reads** are the exception to server reads ([ADR 0012](decisions/0012-audited-reads-in-the-browser.md)). Records and patient search run in Client Components through the same-origin route, and no patient API call exists on the server. A server read of a record writes a false "opened" entry after a refresh and the back button, and search terms can't reach the server without entering the address. Everything else reads on the server, under [ADR 0011](decisions/0011-server-reads-and-refresh.md).

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
`BroadcastChannel`. Sign-out calls Laravel, then always clears the cookie, even if the call fails.

**Header.** It can't go in the root layout, because a catch-all route can't prerender the language switch. Public pages use `PublicHeader`, and the
signed-in top bar sits inside the shell's `<Suspense>`.

The cookie is `HttpOnly`, `Secure` in production, `SameSite=Lax`, and sealed. It ends with the browser. Its lifetime is not the
source of truth: Laravel's idle timeout is.

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
the server starts, in `next start` and `next dev`, and exits with a message naming the setting, never its value.

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
