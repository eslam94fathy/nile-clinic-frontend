# Tech Stack

Each dependency evaluated against what this backend actually requires, and added only when a phase needs it.

Environment on this machine: Node 24.21, pnpm 12.9, npm 11.19, Docker 29.9, Spec Kit 1.0.6.

## Installed (Phase 1)

Exact versions, pinned in `package.json` and `pnpm-lock.yaml`.

| Package | Version | Why it is needed |
|---|---|---|
| `next` | 16.4.5 | Required by the brief. Its server also provides the BFF that token handling requires |
| `react`, `react-dom` | 19.3.1 | Required by Next |
| `next-intl` | 4.14.9 | Arabic and English, with App Router and Server Component support |
| `zod` | 4.6.7 | Validates configuration and the health response; form schemas later |
| `server-only` | 0.0.1 | Build error if server code is imported by client code. Protects the token and secrets |
| `typescript` | 5.9.3 | See below |
| `tailwindcss`, `@tailwindcss/turbopack` | 4.3.4 | Design tokens and logical utilities for RTL; the loader is what Next 16.4's template uses |
| `eslint`, `eslint-config-next` | 10.14.0, 16.4.5 | Linting. See the note below |
| `prettier` | 3.9.10 | Formatting |
| `vitest`, `vite`, `@vitejs/plugin-react`, `jsdom` | 5.1.0, 8.3.5, 6.2.1, 30.1.3 | Unit and component tests. `vite` must be declared, as a peer of the plugin |
| `@testing-library/react`, `@testing-library/dom` | 16.3.3, 10.4.2 | Component state tests |
| `@playwright/test` | 1.64.1 | End-to-end tests |
| `@axe-core/playwright` | 4.14.0 | Automated accessibility checks |
| `openapi-typescript` | 7.13.0 | Generates API types from the backend's contracts; see [ADR 0004](decisions/0004-api-types-from-contracts.md) |
| `@types/node`, `@types/react`, `@types/react-dom` | 24.19.2, 19.3.0, 19.3.0 | Types |

**ESLint 10 and peers.** ESLint 9 is deprecated on npm, so the project uses 10. `eslint-config-next` accepts it (`>=9`), but
three plugins it bundles (`import`, `jsx-a11y`, `react`) don't yet declare support, so `pnpm peers check` reports them. Each
rule the project relies on was shown to fire by injecting a violation, in Phase 1. Recheck when those plugins update.

**Supply-chain policy.** pnpm's minimum release age rejected Playwright 1.65.0, published hours before installation, and
added an automatic exception. The exception was removed and 1.64.1 used instead. **Don't accept such exceptions by default.**
Install scripts stay blocked in `pnpm-workspace.yaml` (`allowBuilds`); nothing currently needs them. `@swc/core` and
`@parcel/watcher` come through next-intl's message extraction feature, which isn't used.

## Planned

Added by the phase that needs them; versions were checked on 2026-11-05.

| Package | Checked | Why it is needed | Added in |
|---|---|---|---|
| `shadcn` (CLI; code is copied in) | 4.23.0 | Accessible, owned components. `init` has an `--rtl` flag, which matters here | Phase 2 |
| `lucide-react` | 1.69.0 | The shadcn icon set; imported per icon | Phase 2 |
| `sonner` | 2.0.8 | Success and failure notices; the shadcn default | Phase 2 |
| `@tanstack/react-query` | 5.106.1 | Client caching, invalidation, and polling. The queue has to poll, and many screens mutate then refresh | Phase 3 |
| `react-hook-form`, `@hookform/resolvers` | 7.91.0, 7.0.3 | Many forms; server `422`s map to fields through `setError` | Phase 3 |
| `iron-session` | 9.0.1 | Seals the token inside the cookie, so a leaked cookie value can't be replayed directly at Laravel. See [ADR 0001](decisions/0001-authentication-bff.md) | Phase 3 |

## Rejected or deferred

| Package | Decision | Reason |
|---|---|---|
| `axios` | **Rejected** | See [ADR 0002](decisions/0002-native-fetch.md). Native `fetch` covers it; interceptors aren't needed because the proxy handles auth centrally |
| `zustand` | **Deferred, not installed** | No justified global client state today: session comes from the server, locale from the URL, server data from TanStack Query. Revisit only with a concrete need |
| `@tanstack/react-table` | **Deferred, not installed** | Its main value is client sorting, filtering, and pagination. This API has no sort parameters and does all paging and filtering server-side. A thin `DataTable` over the shadcn table should suffice. Note also that it's now v9, while shadcn's data-table recipe should be checked for v9 support. Revisit in Phase 2 if column visibility or similar is required |
| `recharts` | **Deferred to reports phase** | Only reports need charts. Decide with that spec |
| `msw` | **Deferred** | Decide in Phase 3 whether component tests need network mocking |
| `jose` | **Not needed** | `iron-session` covers sealing, and the app doesn't verify JWTs |

## TypeScript version

`latest` on npm is 7.0.2, but as of 2026-11-05 the ecosystem doesn't accept it:

| Tool | TypeScript peer range |
|---|---|
| `typescript-eslint` 8.72.1 | `>=4.8.4 <6.1.0` |
| `openapi-typescript` 7.13.0 | `^5.x` |

So the project pins **5.9.3**, the newest 5.x, the only line that satisfies both. Revisit when those
ranges widen.

## Package manager

**pnpm**: strict dependency resolution stops code importing packages it didn't declare, and its supply-chain
policies guard against very new releases.

## To confirm in later phases

- `@hookform/resolvers` 7 with Zod 4: Phase 3.
- `shadcn init` base library choice (`--base radix|base|aria`), and how complete `--rtl` is: Phase 2.
