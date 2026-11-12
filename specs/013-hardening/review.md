# Phase 13 review record

Every finding from the security review, the accessibility checks done by hand, and the speed measurements, with its outcome. The phase
isn't accepted while a finding has no outcome (SC-009). Only results that were actually observed are recorded; anything not yet done says
so.

## Security

Filled by tasks T048 and T049.

2026-11-11. `/security-review` couldn't start (it diffs against `origin/HEAD`, which this repository doesn't have, and the
changes aren't committed), so the same review was done by hand over the working tree's changes against `main`, together with
T048's walk of `src/app/api/`.

| # | Finding | Severity | Outcome |
|---|---|---|---|
| S1 | **Reloading a locked record shows it again.** The lock's state lives only in the page, so pressing F5, entering the same address, or opening it in a new tab starts unlocked: the record is read again (a new `encounter.opened` entry in the doctor's name) and shown with no password, against FR-002 and the edge case "the lock is never bypassed to show content". Found by reading `inactivity-lock.tsx`; not yet reproduced in a browser, and the e2e suite tests only the back button | High | **Fixed** (owner chose the lock marker cookie, 2026-11-11): locking sets `nile_locked` without a request, and record pages carrying it load with only the lock and mount nothing until unlocked. Unit tests pass, and the new e2e test (reload, address typed again, new tab, history, with no reads) passed in the owner's `pnpm test:e2e` run, 2026-11-12 |
| S2 | **`X-Forwarded-For` is passed on as received.** The proxy replaces it, but anything else on the backend's Docker network can reach `frontend:3000` directly and set its own address, which the backend will believe once it trusts the frontend (B1): sign-in limits and audit addresses could be faked from inside that network. In local runs without a proxy the browser's own value passes too, which the backend ignores, as it trusts no proxy there | Low | Accepted by the owner, 2026-11-11 (with the code review's fixes); `docs/deployment.md` now says only trusted containers may join that network, and `deploy/compose.yaml`'s comment no longer claims only the proxy reaches the frontend |
| S3 | **The lock hides content; it doesn't remove it.** It stays in the page, as ADR 0020 requires so nothing typed is lost, so someone with the browser's developer tools on the unlocked computer could read it | Info | Accepted as designed; recorded in ADR 0020's consequences |
| — | Checked, nothing found: the unlock route checks the origin, takes only a password, signs in the **sealed** email, rejects a different account and ends its token, ends the old token, and answers `no-store`; `/api/backend/[...path]` is unchanged from `main` and still refuses sign-in and sign-out however written; the health route reads and says nothing; `poweredByHeader` is off and Caddy drops `Server` (and, since T030, `Via`); the image has no source, settings, or tests, and runs as `node` | — | — |
| S4 | **The example proxy named itself.** Caddy added `Via: 1.1 Caddy` to every answer, though the Caddyfile meant to say nothing about the software in use. Found in T030's run through the proxy | Info | **Fixed:** `-Via` beside `-Server` in `deploy/Caddyfile`. Observed after a proxy restart: neither header in the answer to `/ar/sign-in` |
| — | `pnpm audit --prod` (T049): "No known vulnerabilities found" | — | Nothing to do |

## Code review

2026-11-11, `/code-review` over the branch's changes (T056). Nothing in it was checked at runtime by the reviewer; each item was re-read
in the code before acting. The owner chose to fix as proposed.

| # | Finding | Severity | Outcome |
|---|---|---|---|
| C1 | **Another account could open a locked record.** If someone else signed in from another tab, the cookie named them, and their own password opened the first person's page | High | **Fixed:** the page sends whose it is, and the route answers `409` without calling the backend if the seal names anyone else. Route test added |
| C2 | **Focus didn't come back after unlocking.** It was restored in a microtask, before React removed the dialog and `inert` | Medium | **Fixed:** restored in an effect after the render that unlocks |
| C3 | **An email changed while locked can't unlock**, and the refusal reads like a wrong password | Low | Accepted; recorded in ADR 0020's consequences |
| C4 | **The client address reading swallowed Next.js's own errors**, which could hide a prerender reading request data | Medium | **Fixed:** `unstable_rethrow` first. Test added |
| C5 | The frontend's network is shared with the backend's containers | Low | Same as S2 |
| C6 | **A record kept by Back locked at once** after work on other pages of the tab | Medium | **Fixed** as the owner chose: activity anywhere in the tab counts. Component tests added; the new e2e test passed in the owner's `pnpm test:e2e` run, 2026-11-12 |
| C7 | Two tabs unlocking in the same instant leave one new token never ended | Low | Accepted; recorded in ADR 0020's consequences. It expires at the backend's idle limit |
| C8 | `docs/development-guidelines.md` still said to set `built: true`; Phase 3's contract still described the placeholder | Low | **Fixed**; Phase 3's contract has a note that Phase 13 superseded that part |
| C9 | Signing in and unlocking repeated the backend sign-in and the browser's post | Low | **Fixed:** `features/auth/api/backend-sign-in.ts` and `post-auth.ts`, shared by both |
| C10 | `pnpm start` listened on the computer's name under Git Bash | Low | **Fixed:** `scripts/start-standalone.mjs` sets `HOSTNAME=localhost` (or `START_HOSTNAME`). Observed: it served `/api/health` on `localhost` |

## Accessibility, by hand

From [quickstart.md](quickstart.md), "Accessibility by hand". The automated sweep (every route, both locales, both themes, any WCAG A or AA
violation failing) is recorded in `tasks.md`, T041.

| # | Check | Result | Outcome |
|---|---|---|---|
| A1 | Keyboard only, through each role's journey: every control reachable, focus always visible | Waiting for the owner | |
| A2 | Screen reader (NVDA) on the lock: announced as a dialog named by its heading, nothing behind it read | Waiting for the owner | |
| A3 | Screen reader on a record, a form with errors, and the queue | Waiting for the owner | |
| A4 | 200% and 400% zoom on each role's main screens, in both directions | Waiting for the owner | |
| A5 | Reduced motion: nothing moves that shouldn't | Waiting for the owner | |
| A6 | Focus never hidden under a sticky header or a dialog (WCAG 2.4.11) | Waiting for the owner | |
| A7 | Targets at least 24 by 24 pixels (WCAG 2.5.8) | Waiting for the owner | |
| A8 | Right-to-left reading order matches what's seen, in Arabic | Waiting for the owner | |

## The lock and the headers, by hand

From [quickstart.md](quickstart.md), "The lock, by hand" and "Headers and policy". Filled by task T054.

| # | Check | Result |
|---|---|---|
| L1–L7 | The seven lock steps | *Not yet run* |
| L8 | Five unlocks, from the lock showing to the record showing again, against SC-002's 10 seconds | *Not yet run* |
| H1 | Headers through the proxy, HSTS included; none twice | *Not yet run* |

## Speed

Filled by task T043, from `e2e/live/performance.spec.ts`: the 75th percentile of 8 openings of each screen, on the production build
against the local API. Targets: content within 2,500 ms, a press answered within 200 ms (SC-007).

Observed 2026-11-12, run by Claude Code with `pnpm test:e2e:live e2e/live/performance.spec.ts`: the test passed (1 of 1, 4.0 minutes including the build), in English, with the production build on this machine against the local backend in Docker. Content is Largest Contentful Paint. The press is the theme switch, from press to the next paint. Every screen is within both targets: the slowest content is billing at 1,188 ms, and the slowest press is billing at 80 ms. Record pages aren't measured, as each opening writes a permanent audit entry (ADR 0005); My visits stands in. These are one machine's figures, with the browser and the server on the same computer, so they say nothing about the clinic's network.

| Screen | Content, p75 (ms) | Press, p75 (ms) | Outcome |
|---|---|---|---|
| Receptionist, `/en/dashboard` | 376 | 24 | Within both targets |
| Receptionist, `/en/patients` | 364 | 24 | Within both targets |
| Receptionist, `/en/appointments` | 920 | 32 | Within both targets |
| Receptionist, `/en/queue` | 936 | 72 | Within both targets |
| Receptionist, `/en/billing` | 1,188 | 80 | Within both targets |
| Doctor, `/en/dashboard` | 352 | 24 | Within both targets |
| Doctor, `/en/my/queue` | 348 | 16 | Within both targets |
| Doctor, `/en/my/visits` | 656 | 16 | Within both targets |
| Administrator, `/en/dashboard` | 356 | 16 | Within both targets |
| Administrator, `/en/reports` | 984 | 40 | Within both targets |
| Administrator, `/en/audit` | 716 | 32 | Within both targets |
| Administrator, `/en/staff` | 376 | 32 | Within both targets |
