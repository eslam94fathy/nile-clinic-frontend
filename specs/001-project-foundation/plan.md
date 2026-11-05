# Implementation Plan: Project Foundation

**Branch**: `001-project-foundation` | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-project-foundation/spec.md`

## Summary

A runnable, verified skeleton with no business screens: Next.js 16 with strict TypeScript, Arabic-default and English
routing with correct direction, validated server-side configuration, a landing page proving the server-to-backend chain,
a snapshot of the backend's contracts with generated types, and one command running all checks. A production spike
([research.md](research.md)) settled the routing and caching approach.

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict, `noUncheckedIndexedAccess`), Node 24

**Primary Dependencies**: Next.js 16.4.5 with Cache Components, React 19.3, next-intl 4.14.9, Tailwind CSS 4, Zod 4, `server-only`

**Storage**: None; one language cookie

**Testing**: Vitest 5 and Testing Library (unit and component); Playwright 1.65 with `@axe-core/playwright` (end to end, Chromium)

**Target Platform**: Node server; current desktop browsers

**Project Type**: Web application; the backend is a separate repository

**Performance Goals**: Status appears within 5 seconds, plus rendering, when the backend doesn't answer; `pnpm check` under 5 minutes

**Constraints**: No backend changes. No backend address or settings in anything sent to the browser. Nothing from later phases.

**Scale/Scope**: Two languages, one page plus not-found, 11 contracts

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | How this plan complies | Result |
|---|---|---|
| I. Backend is the source of truth | Health handling uses the generated type; contracts are snapshotted with their commit; no backend change | Pass |
| II. Security and privacy | Settings are server-only, enforced by `server-only`; no response bodies or values are logged; no patient data on the page | Pass |
| III. Role-based UI | No roles in this phase | N/A |
| IV. Feature-based architecture | Status lives in `features/system-status`; Server Components by default; only two small Client Components | Pass |
| V. Strict typing | Strict mode and lint errors for `any`; contract-derived types | Pass |
| VI. Every state designed | Checking, working, unavailable, unreachable, each with progress or retry | Pass |
| VII. Arabic and English, accessible | All text from translations with parity check; logical styles enforced; axe in both languages | Pass |
| VIII. Tested before done | Three test levels, plus live tests | Pass |
| IX. Simplicity | Each dependency has a stated need; no design system, data library, or forms yet. Two small scripts instead of plugins | Pass |
| X. Spec-driven, documented | Full cycle; ADR 0006 records the new decision; documents updated in the same work | Pass |

**Post-design re-check**: Pass, no violations. One practice is newly noted: `use cache` must never hold per-user or
patient data (ADR 0006).

## Project Structure

### Documentation (this feature)

```text
specs/001-project-foundation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/routing-and-commands.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
contracts/                        # backend contract snapshot + SOURCE.json (read-only)
scripts/
├── contracts-refresh.mjs
├── contracts-generate.mjs        # --check mode
├── check-i18n.mjs
└── check-logical-styles.mjs
e2e/
├── support/{fake-backend.mjs,messages.ts,ports.ts}
├── routing.spec.ts
├── system-status.spec.ts
├── no-javascript.spec.ts
├── accessibility.spec.ts
└── live/health.spec.ts
src/
├── app/
│   ├── globals.css
│   └── [locale]/
│       ├── layout.tsx            # root layout: <html lang dir>
│       ├── page.tsx              # landing page
│       ├── not-found.tsx
│       └── [...rest]/page.tsx    # sends unknown paths to not-found
├── components/shared/language-switch.tsx
├── features/system-status/
│   ├── api/check-health.ts       # server-only fetch
│   ├── classify-health.ts        # pure: response → status
│   ├── components/
│   │   ├── system-status.tsx     # async Server Component
│   │   ├── system-status-checking.tsx
│   │   ├── system-status-view.tsx
│   │   └── check-again-button.tsx
│   └── types.ts
├── lib/
│   ├── api/generated/            # generated; one file per contract
│   ├── config/{env-schema.ts,env.ts,validate-on-startup.ts}
│   ├── format/instant.ts
│   └── i18n/{routing.ts,request.ts,navigation.ts,direction.ts}
├── messages/{ar.json,en.json}
├── instrumentation.ts            # startup validation
└── proxy.ts                      # locale routing (research R2)
```

Tests sit beside the code as `*.test.ts(x)`.

**Structure Decision**: The single Next.js project and feature layout from `docs/architecture.md`, adding only what this
phase uses. `features/system-status` is a small real feature, kept separate so that it can be removed or moved when the
signed-in home arrives in Phase 3.

## Complexity Tracking

No violations to justify.
