# Deployment

How to build, configure, run, upgrade, and check the frontend in production, and what must be done outside it before go-live. The decisions
behind it are in [ADR 0021](decisions/0021-security-headers.md) and [ADR 0022](decisions/0022-deployment.md).

## What runs where

```text
Clinic computers ──HTTPS──▶ reverse proxy (Caddy) ──HTTP──▶ frontend (this image, port 3000) ──HTTP──▶ backend (nginx "web", port 80)
                            ports 80 and 443            not published on the host                 the backend's Docker Compose
                            sets HSTS, client address   sets every other security header
```

All three containers share the backend's Docker network, `nile-clinic_default`. Browsers only ever talk to the proxy. The frontend reaches
the backend for them; the backend's address never reaches a browser.

**Only trusted containers may join that network.** The frontend passes on the client address the proxy gives it, and once the backend
trusts the frontend (backend request B1) it believes it. Anything else on the network could reach the frontend directly and give a made-up
address, faking sign-in limits and the audit trail's network addresses. Today only the backend's own containers, the frontend, and the
proxy are there; keep it that way (security finding S2 in [Phase 13's review](../specs/013-hardening/review.md)).

## Build the image

```bash
docker build -t nile-clinic-frontend:<version> .
```

The build needs no setting and holds none. `.dockerignore` keeps `.env*` files, tests, and documents out of it. The image runs Next.js's
standalone server as the unprivileged `node` user on port 3000, and checks its own health every 30 seconds.

## Settings

Given when the container starts, never at build. The server checks them on start and stops with a message naming any that is missing or
invalid.

| Setting | Required | Production value |
|---|---|---|
| `BACKEND_API_URL` | Yes | `http://web/api/v1`: the backend inside the shared network, including `/api/v1` |
| `SESSION_SECRET` | Yes | At least 32 random characters, from the clinic's secret store. Changing it signs everyone out |
| `CLINIC_TIMEZONE` | No | The same as the backend's `CLINIC_TIMEZONE` (default `Africa/Cairo`). If they differ, dates and times are wrong |
| `DESIGN_PREVIEW_ENABLED` | No | Leave unset |

Copy `deploy/frontend.env.example` to `deploy/frontend.env`, which is ignored by git, and fill it in.

## Start it

With the backend already running (so that its network exists):

```bash
cd deploy
cp frontend.env.example frontend.env      # then fill it in
# Replace `clinic.example` in Caddyfile with the clinic's own address.
FRONTEND_VERSION=<version> docker compose up -d
```

Caddy obtains and renews a certificate for the named address by itself. To try it on one machine, name the site `localhost` and uncomment
`tls internal` in the `Caddyfile`; the browser will then warn about Caddy's own certificate authority, which is expected.

## The reverse proxy's duties

Whatever proxy is used, it must do all of these. `deploy/Caddyfile` numbers each one.

1. Terminate HTTPS, and redirect plain HTTP to HTTPS. The session cookie is `Secure`, so over plain HTTP nobody can sign in.
2. Send `Strict-Transport-Security: max-age=31536000`. The application can't, as it's also reached over plain HTTP inside the host.
3. **Replace** `X-Forwarded-For` with the connecting address. Never append: a browser could then put its own address first.
4. Pass `Host` unchanged. The application refuses a change whose `Origin` doesn't match `Host`.
5. Don't buffer responses. Pages stream.
6. Add no `Content-Security-Policy`. The application sends its own, and a second one would combine with it.
7. Be the only way in. Don't publish the frontend's port on the host.

With nginx instead of Caddy:

```nginx
server {
    listen 80;
    server_name clinic.example;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name clinic.example;
    ssl_certificate     /etc/nginx/certs/clinic.crt;
    ssl_certificate_key /etc/nginx/certs/clinic.key;

    add_header Strict-Transport-Security "max-age=31536000" always;

    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_buffering off;
    }
}
```

## Headers

| Header | Set by |
|---|---|
| `Strict-Transport-Security` | The proxy |
| `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy` | The application, on every response ([ADR 0021](decisions/0021-security-headers.md)) |
| `Cache-Control` | The application: pages and routes are never stored by a shared cache |

## Upgrade

```bash
docker build -t nile-clinic-frontend:<new version> .
cd deploy && FRONTEND_VERSION=<new version> docker compose up -d
```

People stay signed in across an upgrade while `SESSION_SECRET` is unchanged. Before every release, run the live end-to-end suite against
the backend, which includes the full journey of each role in both languages:

```bash
pnpm test:e2e:live
```

## Check it

- `docker compose ps` shows the frontend as `healthy`. The health check (`GET /api/health`) says only that the frontend is serving: a
  backend outage doesn't mark it unhealthy, and doesn't restart it.
- The backend's state is on the application's own System status page, on the sign-in page.

## Logs

The frontend writes to its container's output only: `docker compose logs frontend`, or `docker logs <container>`. It writes no patient
details, clinical text, tokens, or addresses with their query strings. `deploy/compose.yaml` keeps at most five files of 10 MB each; adjust
`max-size` and `max-file` there.

## Before production

Each item is outside this application. Update its status here when it's done.

| Item | Owner | Reference | Status |
|---|---|---|---|
| Trust the frontend's address on the backend, so that audit entries and the sign-in limit see each computer (the frontend already forwards the client's address) | Backend | H2, [request B1](../specs/013-hardening/backend-requests.md) | Open |
| A version check when saving a draft, so that one tab can't silently overwrite another's | Backend | G9, [request B2](../specs/013-hardening/backend-requests.md) | Open |
| The same `CLINIC_TIMEZONE` in both applications | IT | H4, [request B3](../specs/013-hardening/backend-requests.md) | Open |
| The session secret generated and kept in a secret store | IT | [Settings](#settings) | Open |
| HTTPS everywhere, including between the proxy and the clinic's computers | IT | [Duties](#the-reverse-proxys-duties) | Open |
| Manage browser extensions on clinic computers, as an extension can ignore what clinical fields ask of it | IT | Phase 8's [privacy review](../specs/008-medical-encounters/privacy-review.md), risk 5 | Open |
| Legal review of Egyptian health-data and data-protection obligations, including audit retention and whether network addresses are personal data, and the questions in Phase 8's privacy review | Legal | [Privacy review](../specs/008-medical-encounters/privacy-review.md) | Open |
| An inactivity lock on clinical pages that can't lose unsaved text | Frontend | [ADR 0020](decisions/0020-inactivity-lock.md) | Done (Phase 13) |
