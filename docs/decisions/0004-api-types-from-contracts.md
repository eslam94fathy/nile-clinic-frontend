# ADR 0004: Generate API types from the backend's OpenAPI contracts

**Status:** Accepted · **Date:** 2026-11-05

## Context

The backend has 11 OpenAPI 3.1 contracts covering all 76 routes, and they match the routes exactly. Writing
types by hand would duplicate them and could drift silently, against the rule that nothing is invented.

## Decision

- Keep a read-only snapshot of the contracts in `contracts/`, with the backend commit it came from recorded.
- Generate TypeScript types with `openapi-typescript` (dev dependency), and commit the output.
- Features name the types they use in `types.ts`, and don't redefine them.
- Updating is a deliberate step: refresh the snapshot, regenerate, and let the type checker show what changed.

Zod schemas are written by hand for forms, and don't validate every response at runtime.

## Alternatives

| Option | Why not |
|---|---|
| Handwritten types | Duplicates the contract, and drift goes unnoticed |
| Fetching contracts from GitHub at build time | Builds then depend on the network, and on a moving target |
| Generated API client (`openapi-fetch`, Orval) | Another dependency and more layers than needed. Could be revisited |
| Runtime validation of all responses | Bundle and maintenance cost. The contracts are verified against routes and tested in the backend |

## Consequences

- **Contract gaps carry over.** Pagination `meta` is untyped in the contracts, so one shared handwritten type
  is needed, and must be confirmed on the live API in Phase 3.
- **Limit of the check.** Contracts are compared with routes, and some Resources have been sampled, but the
  contracts aren't generated from the code. Playwright against the real API is the check against drift.
- **Pins TypeScript to 5.x** for now, because of `openapi-typescript`'s peer range. See
  [tech-stack.md](../tech-stack.md#typescript-version).
