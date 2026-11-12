# Contract: Deployment

What the image, the health check, and the example proxy promise IT staff. Reasons in [research R5–R7](../research.md#r5-passing-on-the-clients-address-h2).
The guide itself goes to `docs/deployment.md`.

## Image

| Property | Value |
|---|---|
| Built from | `Dockerfile` at the repository root, `docker build -t nile-clinic-frontend:<version> .` |
| Base | `node:24-alpine`, pinned to an exact version |
| Runs | `node server.js` from Next.js's standalone output, as user `node`, on port `3000`, `HOSTNAME=0.0.0.0` |
| Holds | The standalone server, `.next/static`, `public`. No source, no dev dependencies, no `.env*`, no secret |
| Health | `HEALTHCHECK` every 30 s, timeout 5 s, 3 retries, calling `/api/health` |
| Stops | On `SIGTERM`, as `docker stop` sends |

`.dockerignore` excludes `.env*`, `.next`, `node_modules`, `e2e`, test output, `.git`, and `specs`/`docs`.

## Settings (at start, never at build)

The existing ones, unchanged, validated at start with a message naming the setting (FR-019):

| Setting | Required | Production value |
|---|---|---|
| `BACKEND_API_URL` | Yes | `http://web/api/v1` on the backend's Compose network |
| `SESSION_SECRET` | Yes | 32+ random characters from the secret store |
| `CLINIC_TIMEZONE` | No | The backend's `CLINIC_TIMEZONE` (H4) |
| `DESIGN_PREVIEW_ENABLED` | No | Unset |

No new setting is added by this phase.

## `GET /api/health`

| | |
|---|---|
| Answer | `200`, `{"status":"ok"}`, `Cache-Control: no-store`, the security headers |
| Reads | Nothing: no cookie, no setting, no backend call |
| Meaning | The frontend server is serving. Says nothing about the backend (owner's choice) |

## Reverse proxy duties

1. Terminate HTTPS; redirect HTTP to HTTPS.
2. Set `Strict-Transport-Security: max-age=31536000`.
3. Replace `X-Forwarded-For` with the connecting address; never append.
4. Pass `Host` unchanged (the origin check compares it with `Origin`).
5. Don't buffer responses (streaming).
6. Add no `Content-Security-Policy` of its own.
7. Be the only way to reach the application: the application's port isn't published on the host.

## Example in `deploy/`

| File | Holds |
|---|---|
| `deploy/compose.yaml` | Services `frontend` (the image, settings from an env file, no published port) and `proxy` (Caddy, ports 80 and 443), joined to the backend's Compose network `nile-clinic_default` as an external network |
| `deploy/Caddyfile` | One site block doing duties 1–6; `tls internal` commented as the local-test option |
| `deploy/frontend.env.example` | The settings above, with placeholders, never real values |

The guide gives the nginx equivalent of the `Caddyfile`, including `proxy_buffering off`.

## Backend requests (written for the backend's owner; nothing changed there)

| # | Request | Why |
|---|---|---|
| B1 | Trust the frontend container's address in `bootstrap/app.php` (`$middleware->trustProxies(at: ...)`) | H2: audit addresses and the sign-in limit see each computer (R5) |
| B2 | A version check when saving a draft | G9: the last of two tabs' saves wins silently |
| B3 | Keep `CLINIC_TIMEZONE` the same as the frontend's | H4 |
