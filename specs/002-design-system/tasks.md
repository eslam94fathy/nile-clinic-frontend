---
description: "Task list for the design system"
---

# Tasks: Design System

**Input**: Design documents from `specs/002-design-system/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/shared-components.md](contracts/shared-components.md), [quickstart.md](quickstart.md)

**Tests**: Required by the spec (FR-036) and the constitution (VIII). Within a story, tests come first and must fail before the code that satisfies them is written.

**Organization**: By user story. The template's order changes in one way: **User Story 1 comes before Foundational**, because the token values and font packages in Foundational depend on the approved direction (FR-001).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: The spec's user story
- Paths are relative to the repository root

## Rules for every task

- Run `pnpm format` after any `shadcn add`. Never accept a `pnpm` release-age exception. Pin exact versions.
- All visible and assistive text comes from `src/messages/{en,ar}.json`, with identical keys. Arabic is written properly, not left as an English placeholder (FR-035).
- Stay in scope: no authentication, proxy to the backend, data-fetching library, role logic, shell, feature screens, cursor pager, or print design (FR-038), and no backend changes (FR-039).
- All test and preview data is synthetic and obviously fake.
- Spike scripts and experiments stay in the scratchpad, and verify the working directory before writing anything.

---

## Phase 1: Setup

**Purpose**: Confirm the starting point, so later failures can be attributed correctly.

- [X] T001 Run `pnpm check` on `002-design-system` before any change, and record the observed result in this file's Evidence section

---

## Phase 2: User Story 1 - Approve the visual direction (Priority: P1) 🎯 Gate

**Goal**: The owner chooses a visual direction before anything is built on it.

**Independent Test**: The owner can review the proposal with no application code, and the choice is recorded.

- [X] T002 [US1] Create a private page proposing at least two distinct directions, published as an Artifact and not committed to the repository. Each direction shows a color palette in both themes, a Latin and Arabic typeface pairing from research R4, and a dense synthetic front-desk sample (queue list with status badges, money, dates) in Arabic and English, light and dark. State each one's trade-offs and recommend one. Colors must be planned to meet the contrast targets in `data-model.md`: "4.5:1 for each declared text and background pair; 3:1 for `border` on status badges, `input`, and `ring` against `background`, in both themes"
- [X] T003 [US1] **STOP. Wait for the owner's approval of a direction or requested changes. No task after this one starts until approval is given.**
- [X] T004 [US1] Write `docs/decisions/0008-visual-direction.md` with the approved direction, the full palette as token values for both themes, typefaces, date, the reasons, and the decision for Western digits in Arabic. This ADR is the durable source for T010 and T011, as the proposal page isn't in the repository. Add it to `docs/decisions/README.md` (FR-002, SC-001)

**Checkpoint**: Direction approved and recorded.

---

## Phase 3: Foundational

**Purpose**: Dependencies, tokens, fonts, theme mechanics, and test infrastructure that every later story needs.

**⚠️ CRITICAL**: Needs T003. No story below can start until this phase is complete.

### Tests for Foundational

- [X] T005 [P] Write tests for `scripts/check-contrast.mjs` in `scripts/check-contrast.test.mjs`: the WCAG ratio against known values, a failing pair fails the script; a token in a declared pair that's missing or non-hex fails it; a palette utility such as `bg-neutral-500` or `bg-black/10`, or a hex color, in a component is reported; and `bg-[Canvas]`, `text-[CanvasText]`, and arbitrary values built only from `var(--token)` are not reported
- [X] T006 [P] Add `DESIGN_PREVIEW_ENABLED` cases to `src/lib/config/env-schema.test.ts`: unset, `true`, and `false` are accepted; any other value fails with a message naming the setting and not its value
- [X] T007 [P] Write `e2e/theme.spec.ts`: no saved choice with a dark device gives `dark`; saved `light` on a dark device is `light` before hydration and afterwards; blocked storage gives no error; a language switch and back keeps the theme (research R5); no console errors in any case. Also assert through `document.fonts` that on an Arabic page the Arabic font's status is `loaded` (research R4)

### Implementation for Foundational

- [X] T008 Run `pnpm dlx shadcn@4.23.0 init --base radix --preset nova --rtl --yes --no-monorepo --no-pointer` to create `components.json` and `src/lib/utils.ts`, then correct `package.json` per research R3: exact versions; `shadcn` and `tw-animate-css` in `devDependencies`; `lucide-react` at 1.69.0. Verify no change to `pnpm-workspace.yaml`
- [X] T009 Run `pnpm dlx shadcn@4.23.0 add alert-dialog badge button direction input label native-select skeleton table textarea sonner --yes` into `src/components/ui/`, then remove `next-themes` from `package.json`. Do not add `dialog`, `select`, `checkbox`, or `separator` (FR-028, research R2, R3). In `src/components/ui/alert-dialog.tsx`, replace `bg-black/10` with `bg-overlay` (FR-003). Run `pnpm format`
- [X] T010 Install the approved typefaces at pinned versions as dev dependencies, and add them to `src/app/[locale]/layout.tsx` with `next/font/local`, using `adjustFontFallback: false, fallback: []` on both, and the variables `--font-latin` and `--font-arabic` (FR-005, research R4). Check whether preload tags are emitted, and record the result in research R4
- [X] T011 Replace `src/app/globals.css` with the approved tokens per `data-model.md`: solid hex on `:root` and `[data-theme="dark"]`, covering surfaces including `overlay`, text, action, lines, `status-{neutral,active,success,warning,muted}` with `-foreground` and `-border`, and `radius`. `overlay` alone may be translucent, as an 8-digit hex value. Use `@custom-variant dark (&:is([data-theme=dark] *))` and `color-scheme` per theme. Set the stack `var(--font-latin), var(--font-arabic), system-ui, sans-serif`. Remove `sidebar-*` and `chart-*`. Set Arabic-safe line height (FR-003, FR-006, FR-007). Add `prefers-reduced-motion` handling that removes or reduces animation
- [X] T012 Create `scripts/check-contrast.mjs` to read both themes from `src/app/globals.css`, check a declared pair list, and scan `src/` outside `globals.css` for raw colors and palette utilities, allowing only the system colors `Canvas` and `CanvasText` and arbitrary values built from token variables (FR-003, FR-004). Add `check:contrast` to `package.json` and to `pnpm check`. Make T005 pass
- [X] T013 Add `DESIGN_PREVIEW_ENABLED` to `src/lib/config/env-schema.ts` as optional `true` or `false`, and to `.env.example` with a comment. Make T006 pass
- [X] T014 Create `src/components/shared/theme/theme-store.ts` for the theme choice per `data-model.md`: `localStorage` key `theme`; stored values `light` and `dark`; "No entry means following the device"; "Any other stored value is treated as no entry"; "Storage failures are ignored, and the device's setting applies"; device changes apply live while following it. Use `useSyncExternalStore`, with a stable server snapshot, to avoid hydration mismatch
- [X] T015 Create `src/components/shared/theme/theme-script.tsx`, a fixed inline script setting `data-theme` on `<html>`, and `src/components/shared/theme/theme-sync.tsx`, a client component re-applying the theme in `useLayoutEffect` after navigation (FR-009, research R5)
- [X] T016 Rewrite `src/components/ui/sonner.tsx` to take its theme from `theme-store.ts`, with no `next-themes` and no `as` casts, and create `src/components/shared/notices.tsx`, which passes `dir` and sets its position by direction (FR-027, research R3)
- [X] T017 Update `src/app/[locale]/layout.tsx`: add `ThemeScript` in `<head>`, `suppressHydrationWarning` on `<html>`, `ThemeSync`, `DirectionProvider` with the locale's direction, `Notices`, token classes on `<body>`, and pass a new `shared` namespace to `NextIntlClientProvider` alongside `error` (research R8). Add the `shared` namespace to `src/messages/en.json` and `src/messages/ar.json`, starting with the "no value" label. Make T007 pass
- [X] T018 [P] Restyle Phase 1 surfaces with tokens and no change to behavior or text: `src/app/[locale]/page.tsx`, `src/app/[locale]/error.tsx`, `src/app/[locale]/not-found.tsx`, `src/components/shared/language-switch.tsx`, `src/features/system-status/components/system-status-view.tsx`, and `src/features/system-status/components/check-again-button.tsx` (FR-011). Existing tests must pass unchanged
- [X] T019 Add a second `next start` server with the preview off to `playwright.config.ts`, with a new port in `e2e/support/ports.ts`, and set `DESIGN_PREVIEW_ENABLED=true` on the existing server. Update `e2e/support/messages.ts` if needed
- [X] T020 Write `docs/decisions/0007-design-system-foundation.md` from the research: Radix over Base UI with what to retest, native selects, own theme code, pinned fonts, and the two-gate preview, and add it to `docs/decisions/README.md`
- [X] T021 Run `pnpm check`. All existing tests must pass, including the Phase 1 axe tests against the new tokens. Record the result

**Checkpoint**: The application has tokens, fonts, and working themes, with nothing else changed.

---

## Phase 4: User Story 2 - Review every component (Priority: P1)

**Goal**: A private place to see every component, in both directions and themes. Built now as a shell, so each later story adds to it.

**Independent Test**: With the setting on, the preview opens in each combination. With it off, the address can't be told apart from an unknown one.

### Tests for User Story 2

- [X] T022 [P] [US2] Extend `src/proxy.test.ts`: with the setting off, `/ar/design-preview` and `/en/design-preview` and their sub-paths are rewritten to an unknown address; with it on, they pass through; a similar path such as `/ar/design-previewx` is unaffected
- [X] T023 [P] [US2] Write `e2e/design-preview-gate.spec.ts`: on the preview-off server, the address returns `404` with the same body size as an unknown address and without a sentinel value; on the preview-on server, `200` with the sentinel; `robots` is `noindex` in both (FR-033, FR-034). Add a Vitest test in `scripts/` or a Playwright step that searches `.next/static` and `.next/server/app` for the sentinel and finds none (SC-008, research R6)

### Implementation for User Story 2

- [X] T024 [US2] Add the first gate to `src/proxy.ts`: read `process.env.DESIGN_PREVIEW_ENABLED` directly, and rewrite a preview path to an unknown path while it's off. **Never re-create the request.** Make T022 pass
- [X] T025 [US2] Create `src/app/[locale]/design-preview/page.tsx` with the second gate: `await connection()` and the setting check inside `<Suspense>`, calling `notFound()` when off, so no prerendered file holds content. It must not call the backend (FR-033, FR-034, research R6)
- [X] T026 [US2] Create `src/features/design-preview/components/preview-section.tsx`, `src/features/design-preview/components/preview-page.tsx`, and `src/features/design-preview/synthetic-data.ts` (with `server-only`). Add the `preview` namespace to both message files, including the sentinel. Demonstration text and data stay in server code, and reach client pieces as props only (research R6). Make T023 pass

**Checkpoint**: The gated preview shell works. Acceptance scenario 2 (switching theme) completes in Phase 8, and "every component" completes in Phase 9.

---

## Phase 5: User Story 3 - Read clinic values correctly (Priority: P1)

**Goal**: Money, dates, times, and instants that can't be displayed wrongly.

**Independent Test**: Render each with synthetic values in a browser far from the clinic's time zone, in both languages.

### Tests for User Story 3

- [X] T027 [P] [US3] Write `src/lib/format/money.test.ts`: `150.00`, `-1250.50`, `12345678901234567.89` keep every digit in both languages; Western digits in Arabic; invalid forms (`150`, `1.5`, `abc`, empty, `null`) give "no value"; and the source doesn't use `Number` or `parseFloat`
- [X] T028 [P] [US3] Write `src/lib/format/clinic-date.test.ts` and `src/lib/format/clinic-time.test.ts`: valid values are returned unchanged, including `24:00` and a five-minute-free time such as `09:21`; `2026-13-45`, `2026-02-30`, `25:00`, `24:01`, and `null` give "no value"
- [X] T029 [P] [US3] Extend `src/lib/format/instant.test.ts`, keeping the existing tests: `parseInstant` gives the same moment for `2026-11-05T14:22:31+00:00` and `2026-11-05T14:22:31.000000Z`, and `null` for malformed values; output has Western digits in Arabic
- [X] T030 [P] [US3] Write component tests in `src/components/shared/values/values.test.tsx`: `Money`, `ClinicDate`, `ClinicTime`, `Instant`, `LtrText`, and `UserText` have the right text, element, and `dir`, and null or invalid input shows the accessible "no value" display
- [X] T031 [P] [US3] Write `e2e/values.spec.ts`: on the preview, with browser zones Los Angeles, UTC, and Tokyo, dates, times, and instants match expected text; values in Arabic text keep their order (US3 scenarios, SC-006)

### Implementation for User Story 3

- [X] T032 [P] [US3] Create `src/lib/format/locale.ts` with the one numerals setting, appending `-u-nu-latn` (FR-017)
- [X] T033 [US3] Create `src/lib/format/money.ts`: validate `^-?\d+\.\d{2}$`, and format the string itself with `Intl.NumberFormat` and currency `EGP` (FR-012)
- [X] T034 [P] [US3] Create `src/lib/format/clinic-date.ts` and `src/lib/format/clinic-time.ts`, validating per research R7 and returning the value unchanged, never using `Date` (FR-013, FR-014)
- [X] T035 [US3] Add `parseInstant` to `src/lib/format/instant.ts`, with a strict pattern and the fraction truncated to three digits, and use `locale.ts` in `formatInstant`, keeping its signature for its caller in `system-status.tsx` (FR-015)
- [X] T036 [P] [US3] Create `src/components/shared/values/no-value.tsx`, an em dash with a hidden translated label, and `src/components/shared/values/ltr-text.tsx` and `src/components/shared/values/user-text.tsx`
- [X] T037 [US3] Create `src/components/shared/values/money.tsx` (isolated with `<bdi>`, without forcing `dir="ltr"`, per research R7), `src/components/shared/values/clinic-date.tsx`, `src/components/shared/values/clinic-time.tsx`, and `src/components/shared/values/instant.tsx` with a required `timeZone` prop (FR-016)
- [X] T038 [US3] Add a values section to the preview in `src/features/design-preview/components/values-section.tsx`, with normal, extreme, null, and malformed values, and values inside Arabic sentences. Make T027 to T031 pass

**Checkpoint**: Later phases can display any clinic value correctly.

---

## Phase 6: User Story 4 - Recognize a status at a glance (Priority: P2)

**Goal**: One badge, one mapping, always labeled.

**Independent Test**: Every status can be identified from its label on a grayscale page.

### Tests for User Story 4

- [X] T039 [P] [US4] Write `src/components/shared/status-badge.test.tsx`: every value of every kind gives the tone in FR-018 and a label in both languages; an unknown runtime value gives neutral and the generic label; the label is real text

### Implementation for User Story 4

- [X] T040 [US4] Create `src/components/shared/status-mapping.ts`, with values typed from the generated contracts per research R12, using `satisfies Record<...>` so that an unmapped value fails type checking (FR-019). `charge` is the union of `ChargeStatus` and the visit's `charge_status`, so it includes `none`
- [X] T041 [US4] Create `src/components/shared/status-badge.tsx` on `src/components/ui/badge.tsx`, using status tokens with a visible border, and add `shared.status.*` to both message files, including `shared.status.unknown` (FR-018, FR-020, FR-031)
- [X] T042 [US4] Add a status section to the preview in `src/features/design-preview/components/status-section.tsx`, showing every value and an unknown value. Make T039 pass
- [X] T043 [US4] Temporarily remove one mapping entry, confirm that `pnpm typecheck` fails, restore it, and record the observation in Evidence (US4 scenario 4)

**Checkpoint**: Status is consistent everywhere.

---

## Phase 7: User Story 5 - Build screens from shared parts (Priority: P2)

**Goal**: States, page parts, forms, confirmation, and notices.

**Independent Test**: A sample list and form, using only shared parts, reach every state and pass the accessibility checks.

### Tests for User Story 5

- [X] T044 [P] [US5] Write `src/components/shared/states/states.test.tsx`: each state's text and announced role per the contract; empty state supports both "nothing yet" and "no matches"; the not-found text is neutral; retry calls its handler
- [X] T045 [P] [US5] Write `src/components/shared/data-table.test.tsx`: each `state`; real table headers; no sort controls; page links with totals and no prefetch; a long unbroken value stays in the DOM whole, and no cell uses truncation. Layout itself is checked in the browser by T061. Use `getByRole`
- [X] T046 [P] [US5] Write `src/components/shared/filter-bar.test.tsx`: Apply writes the address and resets to page one; Reset clears; existing values come from the address; a filter with `inAddress: false` reaches `onApply` and never the address; and a type-level test (`@ts-expect-error`) shows that a filter without `inAddress` doesn't compile
- [X] T047 [P] [US5] Write `src/components/shared/form/form-field.test.tsx`: label, hint, and error are tied to the input through `aria-describedby`, `aria-invalid`; error is announced; required is shown in text; the "no medical details" hint is present in both languages; `FormError` shows every message
- [X] T048 [P] [US5] Write `src/components/shared/confirm-dialog.test.tsx`: states when an action can't be undone; while pending, Confirm doesn't fire twice and Escape doesn't close; failure stays open and shows the error
- [X] T049 [P] [US5] Write `e2e/confirm-dialog.spec.ts` on the preview, in both directions: initial focus on Cancel; repeated Tab and Shift+Tab never leave the dialog (FR-030, research R1); Escape returns focus to the trigger

### Implementation for User Story 5

- [X] T050 [P] [US5] Create `src/components/shared/states/loading-state.tsx`, `empty-state.tsx`, `error-state.tsx`, `forbidden-state.tsx`, and `not-found-state.tsx`, and add their text to `shared` (FR-024)
- [X] T051 [P] [US5] Create `src/components/shared/page-header.tsx` with one `h1` and actions that wrap (FR-021)
- [X] T052 [US5] Create `src/components/shared/data-table.tsx` with a real table at 768 px and up, and cards below, from one column definition (research R9), page links with `prefetch={false}`, mirrored icons, and no sorting (FR-010, FR-022). Long values wrap with `overflow-wrap: anywhere` and are never truncated, so the whole value stays readable by keyboard and assistive technology users
- [X] T053 [US5] Create `src/components/shared/filter-bar.tsx` as a client component: a form with Apply and Reset (research R10), using `useSearchParams` inside `<Suspense>`, with `inAddress: boolean` required on every filter and no default (FR-023)
- [X] T054 [P] [US5] Create `src/components/shared/form/form-field.tsx` and `src/components/shared/form/form-error.tsx`, with no form library (FR-026). Add the "no medical details" hint to `shared`
- [X] T055 [US5] Create `src/components/shared/confirm-dialog.tsx` as a client component on `src/components/ui/alert-dialog.tsx`: call `preventDefault` on the action so it stays open while pending, block Escape while pending, and use `destructive` styling where asked (FR-025, FR-030)
- [X] T056 [US5] Add sections to the preview, in `src/features/design-preview/components/`: `states-section.tsx`; `page-parts-section.tsx` (a sample list using `PageHeader`, `FilterBar`, and `DataTable` in every state, including long mixed-direction synthetic names); `form-section.tsx` (a sample form with field errors, form-level errors, and the hint); `actions-section.tsx` (confirmation in normal, pending, and failed states, and success and failure notices). Make T044 to T049 pass

**Checkpoint**: Every part in the contract exists and can be seen.

---

## Phase 8: User Story 6 - Work in a comfortable theme (Priority: P3)

**Goal**: A person can choose their theme. The mechanics are already in Foundational.

**Independent Test**: With a dark device, choose light, reload, and see light with no flash.

### Tests for User Story 6

- [X] T057 [P] [US6] Extend `e2e/theme.spec.ts`: choosing a theme with the switch by keyboard saves it and applies at once; choosing "device" removes the saved entry and follows the device live; the current choice is exposed to assistive technology in both languages; the saved value is only `light` or `dark`

### Implementation for User Story 6

- [X] T058 [US6] Create `src/components/shared/theme/theme-switch.tsx` as a client component offering light, dark, and device, with labels from `shared` (FR-008). Make T057 pass
- [X] T059 [US6] Show the switch on Phase 1 pages and the preview in `src/app/[locale]/layout.tsx`, beside the language switch

**Checkpoint**: Acceptance scenario 2 of User Story 2 is now testable.

---

## Phase 9: Polish and Acceptance

**Purpose**: Whole-phase verification against [quickstart.md](quickstart.md), and documents.

- [X] T060 Write `e2e/design-system.spec.ts`: axe on the preview in all four language and theme combinations, in each state reachable without interaction and with the confirmation dialog open, with zero serious or critical issues (SC-002, SC-003); and all Phase 1 pages in both themes
- [X] T061 Add to `e2e/design-system.spec.ts`: Tab through the preview in both directions, asserting every interactive element is reached with a visible focus style and targets are at least 24 by 24 px (FR-029, SC-005); the same traversal with a notice open, asserting by bounding box that the notice never covers the focused element (FR-029); no sideways page scrolling at 768, 1024, 1280, and 1920 px in both directions, including with long unbroken values (SC-009); and at 600 px in both directions, the sample table's cards are visible, its `<table>` is hidden, and the page doesn't scroll sideways (US5 scenario 2)
- [X] T062 Confirm that every component in `contracts/shared-components.md` appears in the preview, and add anything missing in `src/features/design-preview/components/` (FR-032, SC-002)
- [X] T063 Update `docs/tech-stack.md`: installed packages with exact versions and reasons, including `cn`'s status and the font packages; `next-themes` rejected; Radix's 60 packages as a known cost; close the two "to confirm" shadcn items (FR-037)
- [X] T064 [P] Update `docs/frontend-blueprint.md`: charge `none`, `Can` to Phase 3, `CursorPager` to Phase 11, the added states and notice, the numerals decision, and that dates and times are shown literally
- [X] T065 [P] Update `docs/architecture.md` for themes, fonts, the preview's two gates, and the proxy's extra rule; and `docs/development-guidelines.md` for token rules, running Prettier after `shadcn add`, and showing values through the shared displays only
- [X] T066 [P] Update `README.md` with the preview setting and how to open it, and `docs/roadmap.md` with `CursorPager` in Phase 11 and `Can` in Phase 3. Add a phase status line, without marking it accepted
- [X] T067 Run `pnpm check`, and record the actual output in Evidence (SC-010)
- [ ] T068 Carry out the by-hand checks in [quickstart.md](quickstart.md), asking the owner to do those requiring human judgment of how Arabic reads, and record who checked what in Evidence. Report anything not done as not done
- [X] T069 Run `/code-review` on the branch and resolve the findings
- [ ] T070 **Ask the owner to accept the phase.** Only then mark the phase Done in `docs/roadmap.md` and set the spec's status to Accepted

---

## Dependencies & Execution Order

```text
Setup ─► US1 (gate: owner approval) ─► Foundational ─► US2 shell ─┬► US3 ─┐
                                                                  ├► US4 ─┼► Polish ─► Acceptance
                                                                  ├► US5 ─┤
                                                                  └► US6 ─┘
```

- **US1 blocks everything after it**, by T003.
- **Foundational** blocks all stories below it.
- **US2 shell** comes before the others, because each adds a section to the preview and tests against it. US2 finishes only when the others do.
- **US3, US4, US5, and US6** don't depend on each other, apart from sharing message files and the preview page. US5's `DataTable` samples read better with US3 and US4 done, so this order is suggested.
- **Within a story**: tests, then `lib/` code, then components, then the preview section.

### Parallel opportunities

All of these touch separate files, and shared message files should be merged one at a time:

```text
Foundational tests:  T005, T006, T007
US3 tests:           T027, T028, T029, T030, T031
US3 implementation:  T032, T034, T036
US5 tests:           T044, T045, T046, T047, T048, T049
US5 implementation:  T050, T051, T054
Documents:           T064, T065, T066
```

## Implementation Strategy

1. **Reach the gate first.** T001 to T003 cost little and prevent the most expensive kind of rework. Nothing is built before approval.
2. **Smallest useful stop:** Foundational, US2 shell, and US3. At that point later phases can already show correct values with the approved look, though the phase isn't acceptable until all stories are done.
3. **Commit small and focused** per the project's conventions, one logical step at a time: the owner asks for each commit.
4. **Report what happened.** Any test failure goes in Evidence and to the owner; tests aren't weakened to pass.

## Evidence

Actual observed results, filled in during implementation.

| Task | Check | Result |
|---|---|---|
| T001 | Baseline `pnpm check` (2026-11-06) | **Failed.** Type checks, lint, format, i18n, styles, contracts, and unit tests passed. E2E: 40 passed, 1 failed: `e2e/routing.spec.ts:69` "language switch keeps the query string". The branch held no code changes, so this comes from Phase 1. Repeating that test 10 times, twice: 6 passed and 4 failed each time, so it's intermittent. Not yet fixed; awaiting the owner's decision |
| T002 | Proposed palettes against WCAG contrast (script, not committed) | All four palettes passed every pair checked, including text 4.5:1, and controls, focus, and status edges 3:1. The proposal's rendering wasn't checked by Claude |
| T001 follow-up | The intermittent test, by owner's decision | Cause: the server's first response holds the link without the query, and the query arrives when the stream resolves. Test now waits for it; 30 of 30 passed. Limit documented in `docs/architecture.md`. Committed separately as `d4f59b3` |
| T010 | Font preloading | Preloaded through the `Link` response header. Fonts total about 180 KB |
| T021 | Checks after Foundational | Unit: 127 passed. E2E: 48 passed. Types, lint, contrast, styles, and i18n passed |
| T043 | Removing a status fails type checking | Removed `seen`: `tsc` reported TS1360, "Property 'seen' is missing", and the preview's use failed too. Restored; `tsc` clean |
| T060, T061 | Defects these tests or a visual review caught, all fixed | (1) Focus rings at 50% opacity were about 2:1, so now solid. (2) A date field showed no ring on `:focus-visible`, so inputs use `:focus`. (3) An invalid field's tint hid its focus ring, so removed. (4) Phone numbers broke mid-digit in tables, so `LtrText` never wraps, with a permanent test. (5) A hint misaligned filter fields, now aligned, with a permanent test |
| T067 | Final `pnpm check` (2026-11-06, after the review's fixes) | **Passed**, exit 0 in 145 s. Unit: 298 passed in 20 files. E2E: 121 passed. An earlier repeat of the whole e2e suite passed 228 of 228, and the filter tests, changed last, passed 10 of 10 |
| T068 | By-hand checks | **Partly done.** Claude viewed screenshots: Arabic light and English dark at 1280 px, and Arabic at 600 px, and zoomed in on a negative Arabic amount, phone numbers, and filters. **Not done, for the owner:** how Arabic reads to a native reader; the dark and light sheets not viewed (Arabic dark, English light); 200% browser zoom; system grayscale; system reduced motion by eye; and a date field in a real Arabic browser, as the test browser showed `mm/dd/yyyy`. Checked only in Chromium |
| T069 | `/code-review` at high effort | 10 findings, all fixed, each with a test: destructive confirm button showed the primary color; a private filter could reach the address if submitted before JavaScript loaded; the filter form remounted, losing focus and typed text; the theme switch did nothing with blocked storage; an encoded preview address got past the proxy's 404, though the second gate still withheld its content; repeated form errors collided on their React key; the same address was pushed again; a developer's `.env.local` could turn on the "preview off" test server; notices kept English labels on Arabic pages; impossible dates in instants rolled forward. The first fix for the form remount dropped text typed before JavaScript loaded, which a browser test caught, so the fields stayed uncontrolled |
