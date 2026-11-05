# Research: Project Foundation

Findings come from a production-build spike of Next.js 16.4.5 and next-intl 4.14.9 run on 2026-11-05 in a
throwaway project, plus the documentation bundled in `node_modules/next/dist/docs/` and next-intl's source.

## R1. Cache Components

**Decision**: Enable `cacheComponents` and `partialPrefetching`, as `create-next-app` 16.4.5 does.

**Rationale**: The bundled docs say both become mandatory in the next major version, so adopting now avoids a
migration. Data is dynamic unless explicitly cached with `use cache`, which suits medical data. The spike showed
the same locale and 404 behavior with the option on and off.

**Consequences**: Recorded in [ADR 0006](../../docs/decisions/0006-cache-components.md). `use cache` is prohibited
for per-user or patient data. Hidden routes stay mounted and re-run effects when shown, which ADR 0005 must allow for.

**Alternative**: Off. Simpler today, but only postpones a required migration.

## R2. Ignoring browser language while honoring a saved choice

**Decision**: Set `localeDetection: false` in next-intl and handle unprefixed addresses in `proxy.ts`: if the first
path segment isn't exactly a supported locale, redirect to `/{saved or default}{path}`.

**Evidence**:

| Test | Result |
|---|---|
| Bare address, browser English, no cookie | Redirects to `/ar` |
| Bare address, cookie `en`, browser Arabic | Redirects to `/en` |
| Bare address, invalid cookie | Redirects to `/ar` |
| `/en` and `/ar`, repeated | `200` with correct `lang` and `dir` |

**Alternatives rejected**:

- **Default detection**: reads `Accept-Language`, so `/` went to `/en` for an English browser. It violates FR-002.
- **Stripping the header and re-creating `NextRequest`**: `/` redirected correctly, but in production `/en` and `/ar`
  **returned 404 intermittently**. Never clone the request in the proxy.

## R3. Saving the language choice

**Decision**: Rely on next-intl's locale `Link`. It writes the cookie on click and disables prefetching (verified in
`BaseLink.js`). Configure a one-year `maxAge`.

**Evidence**: `Set-Cookie` wasn't present on page responses, even with the plain middleware. So saving happens through
the switch, which matches "the visitor's choice" better than recording each visited address.

**Consequence**: Saving a choice needs JavaScript. Opening `/en` directly doesn't change the saved choice.

## R4. Not-found pages

**Decision**: Keep `[locale]/not-found.tsx` and a `[locale]/[...rest]` catch-all that calls `notFound()`. Send unsupported
first segments there through the redirect in R2. Don't use `global-not-found`, which is experimental.

**Evidence** (Chromium):

| Address | JavaScript on | JavaScript off |
|---|---|---|
| `/ar/nope` | `404`, `lang=ar`, `dir=rtl`, Arabic text | `404`, blank |
| `/en/nope` | `404`, `lang=en`, `dir=ltr`, English text | `404`, blank |
| `/fr`, before the R2 rule | `404`, framework's English page, no `lang` | `404`, blank |

The server sends a generic shell for 404s in both Cache Components modes, and the browser renders the content. The spec
was corrected to match. This doesn't affect real pages.

## R5. Status without JavaScript

**Decision**: Stream the status inside `<Suspense>`, and add a `<noscript>` notice.

**Evidence**: With JavaScript off, `/ar` displayed the Arabic heading with correct `lang` and `dir`, but stayed on
"checking", because the streamed replacement needs a script. The spec was corrected.

## R6. Startup validation

**Decision**: Validate in `src/instrumentation.ts` under `NEXT_RUNTIME === 'nodejs'`, printing a safe message and calling
`process.exit(1)`.

**Evidence**: With the setting missing, `next start` printed the message and exited with code 1. `next build` succeeded
without the setting, so builds don't need runtime configuration, and the backend isn't contacted at build time.

**Alternative rejected**: Validating in `next.config.ts` would require runtime settings at build time.

## R7. Dynamic health check

**Decision**: Call `await connection()` inside the Suspense boundary, then `fetch` with `cache: 'no-store'` and
`AbortSignal.timeout(5000)`.

**Evidence**: The build reports `/ar` and `/en` as partial prerenders, and the check returned live results per request.

## R8. Tooling versions

| Decision | Evidence |
|---|---|
| TypeScript newest 5.x (5.9.3) | `create-next-app` templates `^5`; `openapi-typescript` needs `^5.x`; `typescript-eslint` needs `<6.1.0` |
| `@types/node` `^24` | Matches Node 24, and satisfies Vitest's `^22 \|\| >=24` |
| Add `vite` explicitly | Peer of `@vitejs/plugin-react` 6 (`^8`); pnpm's strict resolution requires declaring it |
| `@tailwindcss/turbopack` | The template's loader; replaces the PostCSS plugin assumed earlier |
| `allowBuilds` in `pnpm-workspace.yaml` | Template default blocks `sharp` and `unrs-resolver` install scripts; both work without them, and blocking is safer |
| Commit `AGENTS.md` | `next dev` re-creates it, and it points tools to the bundled docs |

## R9. Checks not provided by existing tools

| Rule | Mechanism |
|---|---|
| `any`, `@ts-ignore` | `typescript-eslint`, as errors |
| Hard-coded visible text | `react/jsx-no-literals`, from `eslint-config-next` |
| Physical direction styles | Small script over source and CSS; no plugin needed |
| Translation parity | Small script comparing nested keys |
| Stale generated types | Generator's `--check` mode |

## R10. End-to-end test of server-side calls

**Decision**: A small fake backend process, controlled over HTTP, for the non-working statuses, plus a separate live
configuration for the real API.

**Rationale**: The check runs on the server, so browser-level request interception can't see it. The fake also proves
"once per page request" and the `Accept-Language` header by counting requests. Live tests aren't part of `pnpm check`,
because it must not depend on Docker, but they must pass for the phase to be complete.
