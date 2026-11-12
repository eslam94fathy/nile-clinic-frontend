# The frontend's production image (ADR 0022): Next.js's standalone server, no source, no settings.
# There's no `public` folder; if one is added, copy it to ./public here too.
# Build: docker build -t nile-clinic-frontend:<version> .   Settings are given at start: see docs/deployment.md.

FROM node:24.21.0-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# The pnpm version pinned in package.json's `packageManager`.
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# No setting is given here: each is read when the server starts.
RUN pnpm build

FROM node:24.21.0-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
# The frontend alone: a backend outage mustn't mark it unhealthy. Alpine has no curl, so Node asks.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "server.js"]
