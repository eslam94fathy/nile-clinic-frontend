# ADR 0022: A standalone Docker image behind Caddy, beside the backend

**Status:** Accepted, by the project owner after Phase 13's review, 2026-11-12

Answers decision Q6 in the [roadmap](../roadmap.md), and prepares the frontend's side of hazard H2. See
[research](../../specs/013-hardening/research.md), R5 to R7, and the [deployment contract](../../specs/013-hardening/contracts/deployment.md).

## Context

The owner decided (2026-11-11) that the frontend runs as a Docker image of the Node server, behind a reverse proxy that terminates HTTPS, on
the same host or network as the backend's Docker Compose, so the backend can trust one known address. The backend configures no trusted
proxies, and the frontend sent no client address, so every audit entry and sign-in attempt appears to come from the frontend.

## Decision

- `output: "standalone"`; a multi-stage `Dockerfile` on a pinned `node:24-alpine`, running `node server.js` as `node`. No setting at build.
- An example in `deploy/`: Caddy terminating HTTPS, setting HSTS, replacing `X-Forwarded-For`, passing `Host`, with the frontend joined to
  the backend's network and not published. nginx equivalents are documented.
- `callBackend` forwards the incoming `X-Forwarded-For` unchanged. The backend is asked to trust the frontend's address (request B1).
- `GET /api/health` reports only that the frontend serves; the backend's state stays on the System status page.
- Errors are read from the container's output; no error-reporting service.

## Alternatives

| Option | Why not |
|---|---|
| A managed platform | Owner's choice; the backend would need to be public, and trusted ranges would be the platform's |
| `next start` with all `node_modules` | Larger image with dev dependencies |
| nginx as the example | Needs buffering and certificates set up by hand; documented instead |
| A health check including the backend | A backend outage would restart the frontend |

## Consequences

- Until the backend trusts the frontend's address, nothing changes on the backend's side; the header is ignored.
- The frontend must be reachable only through the proxy, or a client could supply its own address once the backend trusts the frontend.
