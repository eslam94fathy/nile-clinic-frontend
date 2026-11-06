# Implementation Plan: Design System

**Branch**: `002-design-system` | **Date**: 2026-11-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-design-system/spec.md`

## Summary

Establish the application's look and the parts every later screen is built from. The owner first approves a visual direction. Then
semantic tokens, self-hosted Arabic and Latin fonts, light and dark themes with no flash, shadcn components on Radix with right-to-left
support, value displays that can't corrupt money or dates, a status badge, shared states, and form and confirmation parts are built. A
private preview demonstrates them all.

Production-build spikes settled the approach, and found problems that a plan from documentation alone would have missed. See [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.9.3, Node 24, React 19.3, Next.js 16.4.5 with Cache Components

**Primary Dependencies**: Added: `radix-ui`, `class-variance-authority`, `cn`, `lucide-react`, `sonner`. Build-time: `shadcn`, `tw-animate-css`, two `@fontsource-variable/*` or equivalent, per the approved direction. All pinned exact

**Storage**: One `localStorage` entry for the theme choice. Nothing else

**Testing**: Vitest and Testing Library, Playwright with axe, plus a new contrast script

**Target Platform**: Modern browsers on desktop and tablet, from 768 px wide. Narrower widths degrade to cards

**Project Type**: Web application, frontend only

**Performance Goals**: No visible flash of the wrong theme. Fonts about 214 KB total for the pairing tested in the spike

**Constraints**: WCAG 2.2 AA; logical CSS only; no hard-coded text; no calls to the backend; preview content never prerendered; build needs no network and no runtime configuration

**Scale/Scope**: 11 generated building blocks, about 20 shared components, one preview page

## Constitution Check

*GATE: Passed before research. Re-checked after design, with the same result.*

| Principle | Status | How |
|---|---|---|
| I. Backend is source of truth | Pass | Status values and value formats verified in the generated types and contracts (research R7, R12). No API calls |
| II. Security and privacy | Pass | Synthetic data only. The preview is off by default and server-gated. The theme entry holds no personal data. No token work in this phase |
| III. Role-based UI | Pass | `Can` deferred to Phase 3. Forbidden and neutral not-found states provided for later use |
| IV. Feature-based architecture | **Exception** | Shared parts exist before a second real consumer does: see Complexity Tracking. Otherwise met: formatting in `lib/format`, the preview in its own feature, no network calls |
| V. Strict typing | Pass | Status mapping exhaustive from generated types. `sonner.tsx` rewritten to remove its cast. Money stays a string |
| VI. Every state designed | Pass | This phase creates those states. Confirmation shows progress, stops double submission, and keeps failures visible |
| VII. Bilingual, accessible | Pass | Both languages, four-way axe checks, contrast script, keyboard tests |
| VIII. Tested before done | Pass | See [quickstart.md](quickstart.md). Results recorded in `tasks.md` |
| IX. Simplicity | **Exception** | Abstractions are built before two real uses exist: see Complexity Tracking. Otherwise met: the owner narrowed the component list, there's no `next-themes`, table library, custom select, or filter state library, and every dependency has a stated reason |
| X. Spec-driven | Pass | Full cycle. Decisions recorded as ADRs below |

Principles IV and IX have one justified exception, recorded in Complexity Tracking. All others pass.

## Order of Work

Each step depends on the one before.

1. **Visual direction proposal (gate).** At least two directions, as a private page, using realistic synthetic screens in both languages and
   themes, with typeface pairings from research R4. **Stop for the owner's approval.** Then record the ADR.
2. **Foundation.** `shadcn init`, with the corrections in research R3. Tokens, fonts, theme, and direction in the layout. Restyle Phase 1 pages. Contrast script.
3. **Values and status.** `lib/format`, value displays, and the status badge. These have no dependency on anything visual beyond tokens.
4. **States, page parts, forms, confirmation, notices.**
5. **Preview,** with its two gates and a sentinel test. Each component is added to it as it's built, in practice.
6. **Verification and documents.** All of [quickstart.md](quickstart.md); then the documents listed below.

## Project Structure

### Documentation (this feature)

```text
specs/002-design-system/
├── spec.md
├── plan.md                         # This file
├── research.md                     # Spike evidence and decisions
├── data-model.md                   # Tokens, status mapping, theme choice, value inputs
├── quickstart.md                   # How to validate
├── contracts/shared-components.md  # What later phases can rely on
└── tasks.md                        # Next step: /speckit-tasks
```

### Source Code

```text
src/
├── app/
│   ├── globals.css                  # Tokens for both themes
│   └── [locale]/
│       ├── layout.tsx               # Fonts, ThemeScript, DirectionProvider, Notices
│       └── design-preview/page.tsx  # Second gate, inside Suspense
├── proxy.ts                         # First gate: 404 while the preview is off
├── components/
│   ├── ui/                          # Generated by shadcn
│   └── shared/
│       ├── values/                  # Money, ClinicDate, ClinicTime, Instant, LtrText, UserText
│       ├── states/                  # Loading, Empty, Error, Forbidden, NotFound
│       ├── form/                    # FormField, FormError
│       ├── theme/                   # ThemeScript, ThemeSwitch, store
│       ├── status-badge.tsx
│       ├── page-header.tsx
│       ├── data-table.tsx
│       ├── filter-bar.tsx
│       ├── confirm-dialog.tsx
│       └── notices.tsx
├── features/design-preview/         # Demonstration sections and synthetic data, server-only
├── lib/
│   ├── format/                      # money, clinic-date, clinic-time, instant, numerals setting
│   └── config/env-schema.ts         # Adds DESIGN_PREVIEW_ENABLED
└── messages/{en,ar}.json            # shared.*, preview.*

scripts/check-contrast.mjs           # New; joins pnpm check
e2e/design-system.spec.ts            # New; second server with the preview off
components.json                      # shadcn configuration
```

**Structure Decision**: Follows `docs/architecture.md`. `components/shared` may import `lib/format` and `components/ui`, and never `features/`.
The preview is a feature, so nothing depends on it.

## Decisions to Record

| Document | Content |
|---|---|
| ADR 0007, design system foundation | Radix over Base UI, native selects, own theme code, fonts from pinned packages, two-gate preview, with the evidence |
| ADR 0008, visual direction | The approved direction and typefaces, and Western digits in Arabic |

## Documents to Update

| File | Change |
|---|---|
| `docs/tech-stack.md` | Move installed packages with versions and reasons; add `cn` and font packages; `next-themes` rejected; close the two "to confirm" items about shadcn |
| `docs/frontend-blueprint.md` | Add charge `none`; move `Can` and `CursorPager`; add added states; numeral decision |
| `docs/roadmap.md` | Phase status; `CursorPager` in Phase 11; `Can` in Phase 3 |
| `docs/architecture.md` | Theme, fonts, and preview gate; extend the proxy's description |
| `docs/development-guidelines.md` | Token rules; run Prettier after `shadcn add`; values only through shared displays |
| `.env.example`, `README.md` | The preview setting |

## Risks

| Risk | Mitigation |
|---|---|
| Base UI's focus failure or Radix's select finding came from the spike's setup, so the choice rests on one run | Dialog focus is tested permanently. ADR says what to retest |
| `cn` is young and pre-1.0 | Pinned exact; swapping is mechanical |
| Radix brings 60 packages | Recorded as a known cost; lockfile and release-age policy apply |
| A later `shadcn add` regenerates banned patterns | ESLint, the logical-styles check, and Prettier catch these |
| Fonts other than the tested pair behave differently | The test that the Arabic font really loads applies to whichever is chosen |
| Chromium only | The same limit as Phase 1; cross-browser checks belong to Phase 13 |

## Complexity Tracking

Approved by the project owner on 2026-11-06.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principles IX ("Abstractions MUST wait for at least two real uses") and IV ("shared code moves to a shared location only when a second real consumer exists"): shared components are built before any feature screen uses them. Their only current consumer is the preview, and the others are planned in the roadmap | The roadmap makes this phase's purpose to establish these parts before feature screens. They carry rules every screen must follow: correct money and dates, confirmation of irreversible actions, and all required states. Getting them right once, and accessibly, is cheaper and safer than deriving them under feature pressure | Building only tokens, primitives, and values now would leave Phases 3 to 11 to design `DataTable`, `FilterBar`, `ConfirmDialog`, and `FormField` inside their first screen, with the risk that the first design doesn't fit the next. The owner chose against this |

**Limits on this exception**

- It covers only the components in [contracts/shared-components.md](contracts/shared-components.md), each of which has at least two consumers planned in the roadmap. `CursorPager` has one, so it stays out, in Phase 11.
- Components hold only what the spec requires, with no options added for imagined needs.
- Principles IV and IX apply as written to everything after this phase.
- If a component still has no real consumer by Phase 13, it gets removed.
