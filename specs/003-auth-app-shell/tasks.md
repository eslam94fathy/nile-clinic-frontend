---
description: "Task list for authentication and the app shell"
---

# Tasks: Authentication and App Shell

**Input**: Design documents from `specs/003-auth-app-shell/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/bff-routes.md](contracts/bff-routes.md), [contracts/app-shell.md](contracts/app-shell.md), [quickstart.md](quickstart.md)

**Tests**: Required by the constitution (VIII) and the guidelines' testing table. Within a story, tests come first and must fail before the code that satisfies them is written.

**Organization**: By user story, after a foundation that holds the security core. The foundation is large because sign-in, the shell, and every guard rely on it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: The spec's user story
- Paths are relative to the repository root

## Rules for every task

- Read the relevant guide in `node_modules/next/dist/docs/` before relying on memory. Never re-create the request in `src/proxy.ts`.
- All visible and assistive text comes from `src/messages/{en,ar}.json`, with identical keys. Arabic is written properly, not left as an English placeholder.
- Logical CSS only; design tokens only; use the shared components from Phase 2.
- No `any`, no unexplained `as`. API types come from `src/lib/api/generated/`.
- Never log a token, password, body, or query string. Test data is synthetic. Never commit real credentials.
- Never match on message text; branch on status, `errors` keys, and `reason`.
- Stay in scope: no feature screens, staff management, audited reads, TanStack Query, or backend changes.

---

## Phase 1: Setup

- [X] T001 Install `iron-session` 9.0.1, `react-hook-form` 7.91.0, and `@hookform/resolvers` 7.0.3, pinned exact, without accepting any release-age exception, in `package.json` and `pnpm-lock.yaml`
- [X] T002 [P] Add `SESSION_SECRET`, required and at least 32 characters, with fixed messages that can't print its value, and add tests, in `src/lib/config/env-schema.ts` and `src/lib/config/env-schema.test.ts`
- [X] T003 [P] Set `logging: { incomingRequests: false }` so that `next dev` doesn't log query strings, in `next.config.ts`
- [X] T004 [P] Document `SESSION_SECRET`, `LIVE_ADMIN_EMAIL`, and `LIVE_ADMIN_PASSWORD` with placeholders in `.env.example`, and set a test-only `SESSION_SECRET` on every server in `playwright.config.ts`

---

## Phase 2: Foundational (blocks every story)

### API and session core

- [X] T005 [P] Write tests, then `ApiError` with `status` (`0` when no response arrived), `message` (absent if the body wasn't the expected shape), `fieldErrors`, and `reason`, parsing `unknown` by narrowing, in `src/lib/api/api-error.ts` and `src/lib/api/api-error.test.ts`
- [X] T006 [P] Write tests, then a helper that maps `fieldErrors` onto React Hook Form fields and returns the rest for form level, dropping none, including nested keys, in `src/lib/api/map-field-errors.ts` and its test
- [X] T007 [P] Write tests, then the removal of top-level `links`, `meta.links`, and `meta.path` from JSON objects, leaving other bodies untouched, in `src/lib/api/strip-page-links.ts` and its test
- [X] T008 [P] Write tests, then the return-address validator from [data-model.md](data-model.md#return-address-libauthreturn-addressts), covering other sites, `//`, backslashes, control characters, malformed encoding, `.` and `..`, encoded slashes, `sign-in`, `api`, `_next`, dropped queries and fragments, and audited pages after decoding (`patients/<anything>`, `my/encounters/<anything>`, `my/patients/<anything>`, `audit`), in `src/lib/auth/return-address.ts` and its test
- [X] T009 [P] Write tests, then the origin check: state-changing requests need an `Origin` whose host equals `Host`, and a missing one is refused, in `src/lib/auth/origin-check.ts` and its test
- [X] T010 Write the sealed session, `server-only`: cookie `nile_session`, `HttpOnly`, `Secure` in production, `SameSite=Lax`, `Path=/`, `maxAge: undefined`, holding `token` only, with read, save, and destroy, and an unreadable cookie treated as no session, in `src/lib/auth/session.ts`
- [X] T011 Write the server API module, `server-only`: `await connection()` first (research R3), then token, `Accept: application/json`, `Accept-Language`, `cache: "no-store"`, `redirect: "manual"`, a timeout, returning `ApiError` on failure, taking the locale as an argument, because route handlers have no page locale, in `src/lib/api/server-api.ts`, with a unit test in `src/lib/api/server-api.test.ts`
- [X] T012 Write `getCurrentUser`, a per-render `cache()` over `GET /auth/me`, with outcomes `signed-in`, `no-session`, and `unavailable` as defined in [data-model.md](data-model.md#current-user-from-get-authme-per-request), a wrong-shaped body counting as `unavailable`, and tests, in `src/features/auth/api/current-user.ts`, its test, and `src/features/auth/types.ts`

### Role map and route table

- [X] T013 [P] Write the test first, reading the matrix table from `docs/backend-integration.md` and comparing every cell, then the 18 capabilities and `can()` from [data-model.md](data-model.md#role-map-libauthpermissionsts), in `src/lib/auth/permissions.ts` and `src/lib/auth/permissions.test.ts`
- [X] T014 Write the test first, then the route table from [data-model.md](data-model.md#route-table-libauthapp-routests), with `canOpen(role, route)` and first-segment lookup, free of server-only imports, testing that `onlyRoles` is a subset of the capability's roles and that each role's navigation equals the blueprint's table, in `src/lib/auth/app-routes.ts` and `src/lib/auth/app-routes.test.ts`

### Session end, gate, and frame

- [X] T015 Write tests, then `endSession` with its one-at-a-time guard and full `location.replace` to `/api/auth/session-ended` with `locale` and `return`, in `src/lib/auth/session-end.ts` (in `lib`, because `lib/api/browser-api.ts` needs it and `lib` may import only `lib`) and its test, and the rendering component that calls it, `src/features/auth/components/session-end-redirect.tsx`
- [X] T016 Implement `GET /api/auth/session-ended` as in [bff-routes.md](contracts/bff-routes.md#get-apiauthsession-ended), with a route test, in `src/app/api/auth/session-ended/route.ts` and its test
- [X] T017 Write tests, then the role context, `RoleSync` (calls `router.refresh()` when the gate's role differs from the shell's), and `ScreenGate` for the session end, unavailable, not allowed, and allowed rows of [app-shell.md](contracts/app-shell.md#screengate), in `src/features/auth/components/screen-gate.tsx`, `role-context.tsx`, and their tests
- [X] T018 Move the root layout's header into `src/components/shared/public-header.tsx`, using it from `src/app/[locale]/(auth)/layout.tsx`, `src/app/[locale]/not-found.tsx`, and `src/app/[locale]/design-preview/page.tsx`, and remove it from `src/app/[locale]/layout.tsx` (research R8)
- [X] T019 Create the static frame and the Suspense-wrapped shell with logo, language, theme, and user name (through `UserText`, shortened visibly with the full name available), without the navigation list yet, rendering the session end or a retry error when there's no user, with messages, in `src/app/[locale]/(app)/layout.tsx`, `src/features/app-shell/components/shell.tsx`, `top-bar.tsx`, `shell-skeleton.tsx`, and `src/messages/{en,ar}.json`
- [X] T020 Write tests, then the proxy's address rules from [app-shell.md](contracts/app-shell.md#address-rules-in-the-proxy): bare locale, public, route table paths, preview on and off, unknown with and without a cookie, encoded forms, only checking for the cookie's presence, with `return` holding the path without its locale, in `src/proxy.ts` and `src/proxy.test.ts`
- [X] T021 Replace `src/app/[locale]/[...rest]/page.tsx` with `src/app/[locale]/address-not-found/page.tsx`, and delete `src/app/[locale]/page.tsx`
- [X] T022 Extend the fake backend with sign-in, sign-out, `/auth/me`, `/auth/password`, `/doctors/me`, a paginated list, and a scripted status per endpoint, using a sentinel token, plus a count per endpoint, in `e2e/support/fake-backend.mjs`, and add a sign-in helper in `e2e/support/auth.ts`

**Checkpoint**: The build passes. The new test suites pass. Existing end-to-end tests are updated in T025, as the landing page moves there.

---

## Phase 3: User Story 1 - Sign in and reach the application (P1)

**Goal**: A staff member signs in, in either language, and reaches the landing page.

**Independent Test**: Sign in with correct and incorrect details as each role, in both languages.

### Tests

- [X] T023 [P] [US1] Write component tests for the sign-in form: valid submit, required fields, `422` on `email` shown as sent, an error with no field shown at form level, a `502` shown as general failure, no second submit while pending, in `src/features/auth/components/sign-in-form.test.tsx`
- [X] T024 [P] [US1] Write route tests for `POST /api/auth/sign-in` for every row in [bff-routes.md](contracts/bff-routes.md#post-apiauthsign-in), and that the response body never holds the token, in `src/app/api/auth/sign-in/route.test.ts`
- [X] T025 [US1] Write `e2e/auth.spec.ts`, per locale: success, refusal, throttle message unchanged, API failure, double submit, already signed in, language and theme before sign-in, wrong-shaped return address. Cover sign-in by keyboard alone. Update `e2e/routing.spec.ts`, `e2e/system-status.spec.ts`, `e2e/no-javascript.spec.ts`, `e2e/design-preview-gate.spec.ts`, `e2e/accessibility.spec.ts`, `e2e/branding.spec.ts`, `e2e/theme.spec.ts`, and `e2e/live/health.spec.ts` for the moved landing page and status check, asserting the same behaviour at its new address and weakening nothing

### Implementation

- [X] T026 [US1] Implement `POST /api/auth/sign-in` in `src/app/api/auth/sign-in/route.ts`
- [X] T027 [US1] Write the zod schema with `email` required and `password` required, and the form using React Hook Form and `FormField`, with password-manager `autocomplete` values, sending the active locale, then a full navigation to the validated return address, in `src/features/auth/schemas/sign-in.ts`, `src/features/auth/api/sign-in.ts`, and `src/features/auth/components/sign-in-form.tsx`
- [X] T028 [US1] Create the sign-in page: form in the static shell, "ask an administrator" note, the session-ended message from `ended=1`, the moved status check, and a Suspense-wrapped redirect when the session is valid, with messages in both languages, in `src/app/[locale]/(auth)/sign-in/page.tsx` and `src/messages/{en,ar}.json`
- [X] T029 [US1] Create the landing page with the gate, name, and translated role, in `src/app/[locale]/(app)/dashboard/page.tsx`

**Checkpoint**: Sign-in works against the fake backend in both languages.

---

## Phase 4: User Story 2 - The token can never reach the browser (P1)

**Goal**: The token is proven absent, and the same-origin route refuses what it must.

**Independent Test**: Run the capture journey and search everything the browser received and stored.

### Tests

- [X] T030 [P] [US2] Write route tests for every row in [bff-routes.md](contracts/bff-routes.md#apibackendpath): `auth/sign-in` and `auth/sign-out` in any case, encoded traversal, foreign and missing `Origin`, no session, forwarded and not forwarded headers, redirect and no answer giving `502`, page links removed, statuses passed through, in `src/app/api/backend/[...path]/route.test.ts`
- [X] T031 [US2] Write `e2e/token-absence.spec.ts`: with the fake backend's sentinel token, capture every response body and header in a journey of sign-in, navigation, password change, and sign-out; check script-readable cookies, `localStorage`, `sessionStorage`, IndexedDB, and addresses; search `.next/static` too; assert that the cookie is `HttpOnly`, and session-only; and assert that the fake backend's address is absent. Capture the application server's output, and search it for the sentinel token and the test password (FR-029). Also check that visible links cause one identity call per load (research R3)

### Implementation

- [X] T032 [US2] Implement the same-origin route in `src/app/api/backend/[...path]/route.ts`
- [X] T033 [US2] Write tests, then the browser client as in [bff-routes.md](contracts/bff-routes.md#browser-client-libapibrowser-apits), in `src/lib/api/browser-api.ts` and its test

**Checkpoint**: The token capture test passes. T031's password and sign-out steps are completed once T042 and T046 exist; until then those steps are `test.fixme`, and they must be enabled before this phase's work counts as done.

---

## Phase 5: User Story 3 - See only what your role can use (P1)

**Goal**: Each role sees its navigation, and pages refuse other roles.

**Independent Test**: Compare each role's navigation with the blueprint, then open each other role's pages by address.

### Tests

- [X] T034 [P] [US3] Write component tests for the navigation per role, `aria-current`, and non-color current page indicator, and for `Can` per role, in `src/features/app-shell/components/navigation.test.tsx` and `can.test.tsx`. An API `404` has no consumer until Phase 4, so `NotFoundState` staying neutral is what's tested here (FR-020)
- [X] T035 [US3] Write `e2e/navigation.spec.ts`: exact navigation per role and locale; each other role's page by address shows not allowed, and the response lacks its text; unknown address framed when signed in, and a real `404` when not; role change followed by soft navigation updates the navigation; keyboard operation on wide and narrow screens; a very long name stays within the top bar and remains available in full; a mixed-direction name displays as written; changing language during a session keeps it

### Implementation

- [X] T036 [US3] Write the navigation and narrow-screen menu with translated labels, using the route table, in `src/features/app-shell/components/navigation.tsx`, wired into `shell.tsx`, with messages in `src/messages/{en,ar}.json`
- [X] T037 [US3] Write `Can` over `can()` and the role context, in `src/features/app-shell/components/can.tsx`
- [X] T038 [US3] Write the catch-all (table lookup inside `<Suspense>`, `notFound()` if unknown, gate, then placeholder) and the framed states, in `src/app/[locale]/(app)/[...section]/page.tsx`, `src/features/app-shell/components/placeholder.tsx`, `src/app/[locale]/(app)/not-found.tsx`, and `src/app/[locale]/(app)/error.tsx`

**Checkpoint**: Every role has its navigation, and every other page refuses it.

---

## Phase 6: User Story 4 - Sessions end safely (P1)

**Goal**: Every kind of session end returns the person to sign-in, with nothing left behind.

**Independent Test**: End a session each way, then check the redirect, the cookie, and the back button.

### Tests

- [X] T039 [P] [US4] Write unit tests for the session watcher: a message from another tab navigates, `pageshow` with `persisted` reloads, and it cleans up, in `src/features/auth/components/session-watcher.test.tsx`
- [X] T040 [US4] Write `e2e/session-end.spec.ts`: sign-out with the API up and down; own server unreachable keeps the page with a notice; back button after sign-out; `401` on a page load and on a client request; several simultaneous `401`s give one redirect; two tabs; `500` and no answer keep the session, and retry works; a tampered cookie; the session-ended address with a valid session changes nothing; return rule for `queue` and `patients/5`, with the query dropped; hidden routes are gone after sign-out (ADR 0006's rule 5)

### Implementation

- [X] T041 [US4] Write the session watcher, with `BroadcastChannel` and `pageshow`, mounted in the static frame, in `src/features/auth/components/session-watcher.tsx` and `src/app/[locale]/(app)/layout.tsx`, and make `endSession` broadcast, in `src/lib/auth/session-end.ts`
- [X] T042 [US4] Implement `POST /api/auth/sign-out` per [its contract](contracts/bff-routes.md#post-apiauthsign-out), with a route test, in `src/app/api/auth/sign-out/route.ts` and its test
- [X] T043 [US4] Write the sign-out control, with progress and the failure notice, in `src/features/auth/components/sign-out-button.tsx` and `src/features/auth/api/sign-out.ts`, wired into `top-bar.tsx`, with messages

**Checkpoint**: All P1 stories work against the fake backend.

---

## Phase 7: User Story 5 - Change your own password (P2)

**Goal**: Anyone can see their account and change their password.

**Independent Test**: Change a synthetic account's password, then check the new and old passwords, and a second session.

### Tests

- [X] T044 [P] [US5] Write form tests: valid submit; `12–72` characters and matching checked on the client; `422` on `current_password` shown as sent; another `422` key at form level; fields cleared and confirmation shown on success; no double submit, in `src/features/auth/components/password-form.test.tsx`
- [X] T045 [US5] Write `e2e/account.spec.ts`, per locale: profile values with translated role; each form outcome; the form by keyboard alone; and the session continuing

### Implementation

- [X] T046 [US5] Write the schema (`current_password` required; `password` 12–72 characters; `password_confirmation` matches), API call through the browser client, and form, with `autocomplete` values, in `src/features/auth/schemas/change-password.ts`, `src/features/auth/api/change-password.ts`, and `src/features/auth/components/password-form.tsx`
- [X] T047 [US5] Create the account page with the gate, and the top bar's link, in `src/app/[locale]/(app)/account/page.tsx`, with messages

**Checkpoint**: The account page works. Enable T031's password step.

---

## Phase 8: User Story 6 - A doctor without a profile knows what to do (P2)

**Goal**: Such a doctor sees a clear message, not a confusing not-found.

**Independent Test**: Sign in with a synthetic doctor with no profile, then one who has one.

### Tests

- [X] T048 [P] [US6] Write tests for the profile read (`200`, `404`, `403`, other statuses, `401`) and the gate's two doctor rows, in `src/features/auth/api/doctor-profile.test.ts` and `src/features/auth/components/screen-gate.test.tsx`
- [X] T049 [US6] Write `e2e/doctor-profile.spec.ts`, per locale: landing and `my/*` show the state; account, language, and sign-out still work; the state goes once the profile exists; a failing check shows the retry; administrators and receptionists never make the call

### Implementation

- [X] T050 [US6] Write the per-render `GET /doctors/me` read with `present`, `missing`, and `unknown`, for the doctor role only, and the state, and extend the gate, showing `ForbiddenState` on `403` (US3 scenario 4), in `src/features/auth/api/doctor-profile.ts`, `src/features/auth/components/no-profile-state.tsx`, and `screen-gate.tsx`, with messages

**Checkpoint**: Enable any remaining `test.fixme` in T031.

---

## Phase 9: User Story 7 - Later phases can rely on the list format (P3)

**Goal**: The list format is verified and recorded.

**Independent Test**: Repeat the request against the running API, and compare it with the record.

- [X] T051 [US7] Check `from` and `to` on an empty page against the running API, then write the confirmed type, in `src/lib/api/pagination.ts`
- [X] T052 [US7] Record the confirmed fields, the page-link hazard, the date, and the backend commit in `docs/backend-integration.md`

---

## Phase 10: Polish and Cross-Cutting

- [X] T053 [P] Write live setup, creating a specialty, a receptionist, a doctor with a profile, and a doctor without one through the API, reusing stored sessions, waiting out the sign-in limit, and deactivating accounts afterwards, in `e2e/live/setup.ts` and `playwright.live.config.ts`
- [X] T054 Write `e2e/live/auth.spec.ts`: scenarios 1, 2, 4, 6, 8, 10, 15, 16, 17, and 19 of [quickstart.md](quickstart.md), including the sealed value refused by the API, against the real API
- [X] T055 [P] Extend `e2e/accessibility.spec.ts` with sign-in, landing, account, not allowed, not found, placeholder, and no-profile, across both languages and themes
- [X] T056 Write ADR 0010, and correct ADR 0006's rule 3 and add to ADR 0001, as listed in [plan.md](plan.md#decisions-to-record), in `docs/decisions/` including its `README.md`
- [X] T057 Update every document listed in [plan.md](plan.md#documents-to-update), including the port note in `CLAUDE.md` and `docs/backend-integration.md`
- [X] T058 Run `pnpm check` and `pnpm test:e2e:live`, and record the actual results below
- [ ] T059 Do quickstart scenarios 23 and 24 by hand, time the first sign-in and password change against SC-008, and record the results below, or state that they were not done
- [X] T060 Run `/code-review`, resolve its findings, and run T058 again

---

## Dependencies

- **Setup** before **Foundational**, and Foundational before every story.
- **US1** next, as all other stories need someone signed in.
- **US2** needs US1. **US3** needs US1. **US4** needs US1 and US3 for its soft-navigation cases.
- **US5** needs US2's browser client. **US6** needs US1. **US7** is independent.
- T031's password and sign-out steps complete after T042 and T046.
- **Polish** last.

Within a story: tests, then schemas and API, then components, then pages.

## Parallel Opportunities

- T002, T003, T004.
- T005 to T009, and T013.
- Each story's marked test tasks.
- After US1: US2 and US3 and US6 touch mostly separate files. `screen-gate.tsx`, `top-bar.tsx`, and the message files are shared, so merge those in sequence.
- T053 and T055.

Example, within Foundational:

```text
T005 ApiError
T006 Field error mapping
T007 Page link removal
T008 Return addresses
T009 Origin check
T013 Role map
```

## Implementation Strategy

**MVP**: Setup, Foundational, then US1 and US2. That is a working sign-in with the token proven absent, the part most costly to get wrong.

**Increment**: Add US3 and US4 to meet the roadmap's completion condition: each role sees only its navigation, and ended sessions are handled.

**Finish**: Add US5, US6, and US7, then Polish.

## Test Results

**Status: accepted by the owner on 2026-11-06, after merging PR #5.** All automated checks pass. The owner reported no results for the by-hand checks in T059, so that task stays open and they're recorded as unconfirmed. Acceptance also covered the three defaults raised for confirmation: removing page links (FR-006), a real `404` for unknown addresses with no session, and building `Can` in this phase.

Final run, on 2026-11-06, on Windows, in Chromium, after the code review's fixes:

| Check | Result |
|---|---|
| `pnpm typecheck`, `lint`, `format:check` | No errors or warnings |
| `check:i18n`, `check:styles`, `check:contrast`, `contracts:check` | Passed |
| `pnpm test:unit` | 651 passed, in 46 files |
| `next build` | Succeeded |
| `playwright test` against the fake backend | 270 passed, in 5.0 minutes |
| `playwright test --config playwright.live.config.ts` against the real API at `dff2dca` | 14 passed, in 1.5 minutes |

These were run as separate commands rather than as `pnpm check`, because the machine was short of memory. They're the same steps.

**Checked with a script and real browser, not by a person:**

- Scenario 23: with a real browser profile on disk, closing and reopening Chromium removed the session cookie, and the next visit landed on sign-in. A browser set to restore previous tabs may behave differently, which FR-004 allows for.
- Scenario 24, in part: screenshots of sign-in, landing, account with errors, not allowed, and the narrow layout, all in Arabic, were reviewed by the implementing agent. Direction, mixed text, and layout were correct. The placeholder screenshot was taken and not reviewed.

**T059 stays open, unconfirmed:** reading every screen in Arabic as a native reader, and timing a first sign-in and password change against SC-008. Neither has a reported result. Phase 13's full journeys per role and locale are the natural place to confirm them. A script's 0.7 seconds says nothing about a person.

What testing found:

- **A security bug in the forms, fixed.** Before hydration, a plain form submits by itself as GET, which would put a password in the address and browser history. Forms now use `method="post"`, and their submit stays disabled until hydration. A test without JavaScript covers it.
- **The landing page crashed,** from passing a function as a message value. Fixed.
- **Test corrections:** the theme control's role; a kept-mounted hidden route showing the same text twice; a handle lost to navigation; waiting for a button's fade before measuring contrast.

What the code review (T060) found, and what happened:

| Finding | Outcome |
|---|---|
| A link opened from elsewhere could reach an audited read through the same-origin route, writing a false "opened" entry | **Fixed:** requests not asking for JSON get `406`. Tested |
| Deeper public addresses told a first-time visitor their session ended | Fixed. Tested |
| The `.env.example` placeholder passed as a valid secret | Fixed: it's empty, so the server refuses to start |
| Nested `main` on the signed-in error page | Fixed. Unit tested |
| Non-JSON backend error pages passed through | Fixed: `502`. Unit tested |
| A body failing partway escaped as a raw `500` | Fixed: `502`. Unit tested |
| The public error page lost its header | Fixed. **Not exercised end to end,** as no test can force that page in a production build |
| Duplicated error mapping and path checks | Fixed: one copy of each |
| Status 200 on the framed not-found state | **Accepted,** recorded in ADR 0010 |
| No `h1` on the framed not-found and not-allowed states | **Left as is.** Minor; axe reported nothing serious. Can be revisited in Phase 13 |
| `Secure` cookie over plain HTTP loses the session with no message | **Documented** in the README. HTTPS is already required for production. Belongs with Q6 |

Tests and code were written in the same step, not strictly with tests failing first as this file asks. So the failing state of most tests wasn't observed.

Limits: Chromium only. Real back-forward cache restoration can't be forced in headless mode, so it rests on `no-store` responses and a unit test of the reload handler. Real 8-hour expiry isn't waited for, as revocation gives the same `401`. Client address forwarding isn't built, so H2 stays a production blocker.
