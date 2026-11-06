# Nile Clinic Frontend

Internal staff frontend (administrator, receptionist, doctor) for the existing Laravel API at
<https://github.com/eslam94fathy/nile-clinic>. Not a patient portal.

See `docs/roadmap.md` for phase status. Work on the current phase only.

## Read first

- `.specify/memory/constitution.md`: binding rules; it wins over everything here.
- `docs/backend-integration.md`: verified API behavior, permissions, hazards, gaps.
- `docs/architecture.md`, `docs/decisions/`: design and its reasons.
- `docs/development-guidelines.md`: coding standards.

## Non-negotiables

- **Never invent API details.** Check the backend's `specs/*/contracts/*.openapi.yaml` and source before
  using an endpoint. Never modify the backend unless explicitly asked.
- **Tokens never reach the browser**, in any storage or response. They stay sealed in the HttpOnly cookie.
- **Never log patient data, clinical content, or query strings.** Tests use synthetic data only.
- **Some reads write permanent audit entries**: `GET /patients/{id}`, `GET /doctors/me/encounters/{id}`,
  `GET /doctors/me/patients/{id}/encounters`, `GET /audit-entries`. Never auto-refetch, retry, or prefetch
  them. See ADR 0005.
- **Role-based UI is UX only**; the backend decides. Handle `401`, `403`, and `404` everywhere.
- **No machine-readable error codes exist** except 409 `reason`. Names like `not_changeable` in contracts are
  translation keys, not wire values. Never match on message text.
- **Money stays a string; no floats.** Clinic dates and wall-clock times are shown as sent; UTC instants are
  shown in the clinic's time zone, never the browser's.
- **No `any`.** No hard-coded user-facing text. Logical CSS only, for RTL.
- **Every view needs** loading, error, empty, and success states.
- **Add dependencies only when needed**, with the reason in `docs/tech-stack.md`. Zustand, TanStack Table, and
  Axios are deliberately not in use.
- **TypeScript is pinned to 5.x** because tooling doesn't yet accept 7.

## Workflow

Spec Kit for every significant feature: `/speckit-specify`, `/speckit-clarify`, `/speckit-plan`,
`/speckit-tasks`, `/speckit-analyze`, `/speckit-implement`, then test and `/code-review`. Don't skip
specifications or start future phases. Record decisions as ADRs. Ask when a business requirement is unclear.
Report only test results that were actually observed. Keep documents accurate, labelling anything undecided.

## Backend for local work

Clone with `git clone -c core.longpaths=true <url>` on Windows, because Postman example paths exceed the path
limit. Run it with Docker Compose as described in its README; the API is at `http://localhost:<APP_PORT>/api/v1`.
It has no default accounts: create one with `php artisan staff:create-admin`.

## Commands

`pnpm check` runs every quality check and must pass before work is called complete. `pnpm test:e2e:live` also needs the
backend. See the README for the rest. The backend's port varies by machine, so check with `docker ps`; `BACKEND_API_URL` in `.env.local` holds it.

**Next.js here is newer than most training data.** Read `node_modules/next/dist/docs/` before relying on memory; see `AGENTS.md`.
Never re-create the request in `src/proxy.ts`, and never use `use cache` on personal data (ADR 0006).
