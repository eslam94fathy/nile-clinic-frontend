# Interface Contract: Routing and Commands

This feature's external interfaces. Backend API contracts live in the repository's root `contracts/` folder.

## Routing

| Request | Response |
|---|---|
| `GET /` with a valid saved language | `307` to `/{saved}` |
| `GET /` with no saved language, or an invalid one, whatever `Accept-Language` says | `307` to `/ar` |
| `GET /ar`, `GET /en` | `200`; first bytes hold `<html lang dir>`; status streams in afterwards |
| `GET /{other}/...`, where `{other}` isn't exactly `ar` or `en`, including `/AR` | `307` to `/{saved or ar}/{other}/...`, which is then a `404` |
| `GET /ar/{unknown}`, `GET /en/{unknown}` | `404`; localized not-found page in the browser |
| Query strings | Preserved through redirects |
| `/_next/*`, `/api/*`, and paths with a file extension | Not handled by the proxy |

## Backend call

| Item | Value |
|---|---|
| Request | `GET {BACKEND_API_URL}/health`, from the server only |
| Headers | `Accept: application/json`, `Accept-Language: {locale}` |
| Timeout | 5 seconds |
| Caching | None |
| Redirects | Not followed; treated as `unreachable` |
| Frequency | Once per page request or "check again" |

## Package commands

| Command | Behavior | Needs backend |
|---|---|---|
| `pnpm dev` | Development server | For a working status |
| `pnpm build`, `pnpm start` | Production build, and running it | `start`: for a working status |
| `pnpm typecheck` | TypeScript, no output | No |
| `pnpm lint` | ESLint; any warning fails | No |
| `pnpm format`, `pnpm format:check` | Prettier write, or verify | No |
| `pnpm check:i18n` | Translation parity; names mismatched keys | No |
| `pnpm check:styles` | Physical direction styles; names file and line | No |
| `pnpm contracts:generate` | Regenerates types from the snapshot | No |
| `pnpm contracts:check` | Fails if generated types are out of date | No |
| `pnpm contracts:refresh <path>` | Copies contracts from a clean backend checkout, records its commit, and regenerates | No, only a checkout |
| `pnpm test:unit` | Unit and component tests | No |
| `pnpm test:e2e` | Builds, then end-to-end tests against the fake backend | No |
| `pnpm test:e2e:live` | Builds, then end-to-end tests against the real API, using `.env.local` | **Yes** |
| `pnpm check` | All of the above checks, stopping at the first failure; excludes live tests | No |

All return non-zero on failure.
