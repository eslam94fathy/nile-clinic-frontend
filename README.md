# Nile Clinic Frontend

Internal staff application for the Nile Clinic management system, for administrators, receptionists,
and doctors. Arabic and English, RTL and LTR. It is a frontend for the existing
[Laravel API](https://github.com/eslam94fathy/nile-clinic); there is no patient portal.

> **Status: Phase 5 patients complete.** Staff can sign in and change their password, an administrator can set up staff,
> specialties, doctors, schedules, time off, and fees, and reception can find, register, view, and correct patients. Later phases' menu entries show "not available yet". See the [roadmap](docs/roadmap.md).

## Prerequisites

- Node.js 24 or newer
- pnpm 12 (`corepack enable` picks up the version from `package.json`)
- The backend running through its Docker Compose setup; see its README

On Windows, clone the backend with `git clone -c core.longpaths=true <url>`, because some of its file paths
exceed the Windows limit.

## Setup

```sh
pnpm install
pnpm exec playwright install chromium    # only needed for end-to-end tests
cp .env.example .env.local               # PowerShell: Copy-Item .env.example .env.local
```

Set `BACKEND_API_URL` and `SESSION_SECRET` in `.env.local`, then start the app:

```sh
pnpm dev
```

Open <http://localhost:3000>. It should show the sign-in page in Arabic, right to left, with the status "النظام يعمل" (the system is working). There are no default accounts: create an administrator with the backend's `staff:create-admin` command.

## Configuration

Settings are server-side only, are validated at startup, and stop the app with a clear message when invalid.

| Setting | Required | Description |
|---|---|---|
| `BACKEND_API_URL` | Yes | Backend address, including `/api/v1`. The port is the backend's `APP_PORT`, which differs per machine: its default is 8080, but if something else holds that port, it will be different. Check with `docker ps`. |
| `SESSION_SECRET` | Yes | Seals the session cookie. At least 32 random characters. Changing it signs everyone out. |
| `CLINIC_TIMEZONE` | No | Must match the backend's `CLINIC_TIMEZONE`. Default `Africa/Cairo`. |
| `DESIGN_PREVIEW_ENABLED` | No | `true` shows every shared component at `/ar/design-preview` and `/en/design-preview`, with made-up data. Leave it unset in production, where the address then behaves like any unknown one. |

A production build marks the cookie `Secure`, so it must be served over HTTPS, or `localhost`. Over plain HTTP, the browser discards the cookie, and sign-in returns to the sign-in page with no message.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build`, `pnpm start` | Production build, and running it |
| `pnpm check` | **Every quality check.** Run before considering work complete. Doesn't need the backend |
| `pnpm typecheck`, `pnpm lint` | TypeScript; ESLint, where any warning fails |
| `pnpm format`, `pnpm format:check` | Prettier: write, or verify |
| `pnpm check:i18n` | Translation files have identical keys |
| `pnpm check:styles` | No physical direction styles, such as `ml-4` |
| `pnpm check:contrast` | Design tokens meet WCAG contrast in both themes, and components use no raw colors |
| `pnpm test:unit` | Unit and component tests |
| `pnpm test:e2e` | Builds, then end-to-end tests against a fake backend |
| `pnpm test:e2e:live` | Builds, then end-to-end tests against **the real backend** from `.env.local`. Needs `LIVE_ADMIN_EMAIL` and `LIVE_ADMIN_PASSWORD`, a synthetic administrator, and creates synthetic accounts, which it deactivates afterwards |

## Backend contracts

`contracts/` holds a read-only snapshot of the backend's OpenAPI contracts, and `contracts/SOURCE.json` records the
commit it came from. API types in `src/lib/api/generated/` are generated from them: never write API types by hand.

To update them from a clean backend checkout:

```sh
pnpm contracts:refresh <path-to-backend-checkout>
```

Then review the differences. The type checker shows what the change affects.

## Documentation

| Document | Contents |
|---|---|
| [Constitution](.specify/memory/constitution.md) | The non-negotiable project rules |
| [docs/backend-integration.md](docs/backend-integration.md) | Verified API behavior, permission matrix, hazards, gaps |
| [docs/architecture.md](docs/architecture.md) | System design, source layout, data flow, auth |
| [docs/tech-stack.md](docs/tech-stack.md) | Every dependency and why |
| [docs/frontend-blueprint.md](docs/frontend-blueprint.md) | Routes, navigation, dashboards, workflows, design system |
| [docs/development-guidelines.md](docs/development-guidelines.md) | Coding standards |
| [docs/roadmap.md](docs/roadmap.md) | Phases and decisions |
| [docs/decisions/](docs/decisions/README.md) | Architecture Decision Records |

## Workflow

Features are built with [GitHub Spec Kit](https://github.com/github/spec-kit): Specify, Clarify, Plan, Tasks, Analyze,
Implement, Test, Review. Specifications live in `specs/`.
