# Quickstart: Validating Phase 13

Each check names the requirement it proves. Results go in `tasks.md` (automated) and `review.md` (reviews and by-hand checks), with
what was actually observed.

## Prerequisites

- The backend running with Docker Compose (`docker ps` shows `nile-clinic-web-1`), and `.env.local` holding `BACKEND_API_URL`,
  `SESSION_SECRET`, and the synthetic administrator for live tests, as in earlier phases.
- Docker able to build images, for the deployment checks.

## Automated

| Command | Proves |
|---|---|
| `pnpm check` | Types, lint (including `react/no-danger`), formats, messages, logical styles, contrast, contracts, unit and component tests (lock timing, unlock answers, sealed fields, headers constant), end-to-end on the production build with the fake backend (lock on both pages, both locales and themes; headers on every route kind; no policy violation; accessibility sweep of every route) |
| `pnpm test:e2e:live` | The journey suite in both locales (FR-015), unlock's audit entries on the real API (SC-003), the server's output free of patient data, clinical text, tokens, and query strings (FR-024), and the speed measurements (SC-007) |
| `pnpm audit --prod` | Known vulnerabilities in what ships (FR-013) |

## The lock, by hand (US1)

1. As a doctor, open a draft record, type a sentence without saving, and leave the mouse and keyboard alone for 5 minutes.
   **Expect**: an opaque lock with your name; nothing of the record visible; Tab stays inside the lock.
2. Enter a wrong password. **Expect**: the backend's message; still locked.
3. Enter the right password. **Expect**: the page as it was, your sentence there, unsaved; the audit trail (as an administrator) shows a
   sign-in and a sign-out for you, and no new "opened".
4. Lock again with the finalize confirmation open, unlock. **Expect**: the confirmation still open.
5. Lock again, choose sign out. **Expect**: the warning about unsaved text; confirm signs you out.
6. Open a patient's history and let it lock. Open the dashboard and wait 5 minutes. **Expect**: the history locks; the dashboard never does.
7. Hide the tab for 6 minutes, return. **Expect**: the lock is already there before any content shows.

## Headers and policy (US2)

```bash
curl -sI https://<host>/ar/sign-in      # through the proxy: every header in contracts/security-headers.md, plus HSTS
curl -sI http://localhost:3000/api/health   # inside the host, without the proxy: no HSTS
```

Open every role's main screens with the browser's console open. **Expect**: no "Content Security Policy" message, and no flash of the
wrong theme on first load in either theme.

## Deployment (US5)

Following only `docs/deployment.md`, on a clean checkout:

1. Build the image. **Expect**: the build succeeds with no setting given.
2. Start `deploy/compose.yaml` with `tls internal`, beside the running backend. **Expect**: `https://localhost` shows sign-in; signing in works.
3. Remove `SESSION_SECRET` and restart. **Expect**: the container exits, naming the setting.
4. Stop the backend. **Expect**: the container stays healthy; the System status page says the backend is unreachable.
5. `docker logs` the container after a journey. **Expect**: no patient name, clinical text, token, or query string.
6. Time it. **Expect**: under one hour for someone who didn't write it (SC-008).

## Accessibility by hand (US4)

Done by the owner, results in `review.md`: keyboard-only through each role's journey; a screen reader (NVDA) on the lock, a record, a
form with errors, and the queue; 200% and 400% zoom on the main screens in both directions; reduced motion; focus never hidden under a
sticky header or dialog (WCAG 2.4.11); targets at least 24 by 24 pixels (2.5.8).

## Security review (FR-013)

Run `/security-review`, walk the BFF routes by hand as described in research R12, and record every finding with its outcome.
