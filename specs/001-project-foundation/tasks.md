# Tasks: Project Foundation

**Input**: Design documents from `specs/001-project-foundation/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md),
[contracts/routing-and-commands.md](contracts/routing-and-commands.md), [quickstart.md](quickstart.md)

**Tests**: Required by the spec (FR-021) and the constitution (VIII). Within a story, tests come first.

**Format**: `[ID] [P?] [Story] Description`. `[P]` means it can run in parallel, because it touches different files and
depends on nothing incomplete.

## Phase 1: Setup

**Purpose**: The project can be installed and run.

- [X] T001 Create `package.json` with `"packageManager": "pnpm@12.9.1"` and the scripts from contracts/routing-and-commands.md, and `pnpm-workspace.yaml` with `allowBuilds: { sharp: false, unrs-resolver: false }` (research R8)
- [X] T002 Install dependencies, at exact versions: `next@16.4.5`, `react@19`, `react-dom@19`, `next-intl@4.14.9`, `zod@4`, `server-only`; dev: `typescript@5.9.3`, `@types/node@24`, `@types/react`, `@types/react-dom`, `eslint@10.14.0` (9 is deprecated), `eslint-config-next@16.4.5`, `prettier`, `tailwindcss@4`, `@tailwindcss/turbopack@4`, `vitest@5`, `vite@8`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@playwright/test@1.64.1` (1.65.0 failed the release-age policy), `@axe-core/playwright`, `openapi-typescript@7.13.0`; result in `pnpm-lock.yaml`
- [X] T003 [P] Create `tsconfig.json` from the Next template, with `strict` and `noUncheckedIndexedAccess`, the `@/*` alias, and excluding `e2e` build output
- [X] T004 [P] Create `next.config.ts` with `cacheComponents: true`, `partialPrefetching: true`, `poweredByHeader: false`, the `@tailwindcss/turbopack` CSS rule, and the next-intl plugin pointing to `src/lib/i18n/request.ts`
- [X] T005 [P] Create `.gitignore` (template, plus `.idea/`, `!.env.example`, `test-results/`, `playwright-report/`) and `.gitattributes` (`* text=auto eol=lf`)
- [X] T006 [P] Create `.env.example` with placeholders and a comment per setting: `BACKEND_API_URL=http://localhost:8080/api/v1`, `CLINIC_TIMEZONE=Africa/Cairo`; create local `.env.local` with port 8081 (git-ignored)
- [X] T007 [P] Create `eslint.config.mjs` from the Next template, adding as errors `@typescript-eslint/no-explicit-any`, `@typescript-eslint/ban-ts-comment`, and `react/jsx-no-literals` for `src/**/*.tsx` outside tests, and ignoring `src/lib/api/generated/**`
- [X] T008 [P] Create `.prettierrc.json` and `.prettierignore` (`.next`, `pnpm-lock.yaml`, `contracts`, `src/lib/api/generated`, `specs`, `docs`, `.specify`, `.claude`, `*.md`)
- [X] T009 [P] Create `vitest.config.ts` (jsdom, React plugin, `@` alias, `server-only` aliased to an empty stub, `e2e/**` excluded)

**Checkpoint**: `pnpm install` succeeds.

---

## Phase 2: Foundational

**Purpose**: Shared pieces all stories need. **No story work begins before this is finished.**

- [X] T010 [P] Write tests for the configuration schema in `src/lib/config/env-schema.test.ts`: `BACKEND_API_URL` "Absolute `http` or `https` URL", trailing slash removed; `CLINIC_TIMEZONE` "Valid IANA time zone; default `Africa/Cairo`"; failure messages name the setting and never contain values
- [X] T011 [P] Implement `src/lib/config/env-schema.ts` (pure parse with Zod) and `src/lib/config/env.ts` (`server-only`, cached result)
- [X] T012 Create `src/instrumentation.ts`: under `NEXT_RUNTIME === 'nodejs'`, validate, print a safe message, and call `process.exit(1)` on failure (research R6)
- [X] T013 [P] Create i18n modules: `src/lib/i18n/routing.ts` (`locales: ['ar','en']`, `defaultLocale: 'ar'`, `localePrefix: 'always'`, `localeDetection: false`, cookie `NEXT_LOCALE` with one-year `maxAge`), `src/lib/i18n/request.ts`, `src/lib/i18n/navigation.ts`, `src/lib/i18n/direction.ts`
- [X] T014 [P] Create `src/app/globals.css` with Tailwind import and minimal readable defaults, using logical properties only
- [X] T015 [P] Create `src/messages/ar.json` and `src/messages/en.json` with identical keys: `meta`, `landing`, `status`, `notFound`, `language`
- [X] T016 Create root layout `src/app/[locale]/layout.tsx`: `generateStaticParams`, locale guard, `setRequestLocale`, `<html lang dir>`, translated metadata with `robots: noindex`

**Checkpoint**: Foundation ready; `pnpm build` succeeds.

---

## Phase 3: User Story 1 - Right language and direction (Priority: P1) 🎯 MVP

**Goal**: Arabic by default, English on request, with the correct direction, one-action switching, and a remembered choice.

**Independent Test**: Open the bare address, confirm Arabic and right to left, switch, confirm English and left to right, and return to the bare address.

### Tests for User Story 1

- [X] T017 [P] [US1] Write `src/lib/i18n/direction.test.ts` for each locale's direction
- [X] T018 [P] [US1] Write `src/proxy.test.ts` covering each routing row in contracts/routing-and-commands.md, including ignored `Accept-Language`, invalid cookie, `/AR`, and preserved query string
- [X] T019 [P] [US1] Write `e2e/routing.spec.ts` for all US1 acceptance scenarios and edge cases, including raw first-response `lang` and `dir`, and JavaScript disabled

### Implementation for User Story 1

- [X] T020 [US1] Implement `src/proxy.ts`: redirect when the first segment isn't exactly a supported locale, else call next-intl's middleware; **never clone the request** (research R2)
- [X] T021 [P] [US1] Create `src/components/shared/language-switch.tsx` using next-intl's locale `Link`, labelled in the target language with a matching `lang` attribute
- [X] T022 [P] [US1] Create `src/app/[locale]/not-found.tsx` and `src/app/[locale]/[...rest]/page.tsx` (research R4)
- [X] T023 [US1] Create landing page `src/app/[locale]/page.tsx` with translated heading and language switch; add `<noscript>` notice (research R5)

**Checkpoint**: US1 tests pass.

---

## Phase 4: User Story 2 - System reachability (Priority: P1)

**Goal**: The landing page reports the backend's status from a server-side check.

**Independent Test**: See "working" with the backend running; point the setting at a wrong address and see "cannot reach".

### Tests for User Story 2

- [X] T024 [P] [US2] Create `e2e/support/fake-backend.mjs`: HTTP control endpoint; modes `ok`, `unavailable`, `html-404`, `bad-shape`, `ok-with-unavailable-body`, `redirect`, `hang`, `slow`, `destroy`; records request count and `Accept-Language`
- [X] T025 [P] [US2] Create `playwright.config.ts`: sequential, Chromium, web servers for the fake backend and `next start` with `BACKEND_API_URL` pointing to it
- [X] T026 [P] [US2] Write `src/features/system-status/classify-health.test.ts` for all rows in data-model.md
- [X] T027 [P] [US2] Write `src/lib/format/instant.test.ts`: uses the given time zone, not the system's, in both languages
- [X] T028 [P] [US2] Write `src/features/system-status/components/system-status-view.test.tsx`: each status's text, `role="status"`, and retry present only for non-working statuses
- [X] T029 [US2] Write `e2e/system-status.spec.ts` for all US2 acceptance scenarios: each mode, 5-second bound, "check again", one backend request per page load, `Accept-Language` sent, and backend address absent from the page and from all browser requests

### Implementation for User Story 2

- [X] T030 [US2] Generate only the health contract's types by running a first version of the generator, enough for `src/lib/api/generated/health.ts`; US4 completes the snapshot
- [X] T031 [P] [US2] Implement `src/features/system-status/types.ts` and `src/features/system-status/classify-health.ts`, using a Zod schema checked against the generated `Health` type
- [X] T032 [P] [US2] Implement `src/lib/format/instant.ts` with `Intl.DateTimeFormat` and an explicit time zone
- [X] T033 [US2] Implement `src/features/system-status/api/get-health.ts`: `server-only`, `redirect: 'manual'`, `cache: 'no-store'`, 5-second timeout, `Accept-Language`; never logs bodies or the address
- [X] T034 [P] [US2] Implement `src/features/system-status/components/system-status-view.tsx` and `check-again-button.tsx` (Client Component using `router.refresh()` in a transition, showing "checking" while pending)
- [X] T035 [US2] Implement `src/features/system-status/components/system-status.tsx` (async, `await connection()`), and mount it inside `<Suspense>` in `src/app/[locale]/page.tsx`

**Checkpoint**: US1 and US2 pass; the phase's main goal is demonstrated.

---

## Phase 5: User Story 3 - One set of quality checks (Priority: P2)

**Goal**: One command runs every check, and each rule is shown to fail when broken.

**Independent Test**: `pnpm check` passes when clean, and fails for each injected violation.

- [X] T036 [P] [US3] Write `scripts/check-i18n.test.mjs`, then implement `scripts/check-i18n.mjs`: reports missing and extra nested keys by name
- [X] T037 [P] [US3] Write `scripts/check-logical-styles.test.mjs`, then implement `scripts/check-logical-styles.mjs`: finds physical Tailwind classes and CSS properties in `src/`; reports file and line
- [X] T038 [P] [US3] Write `e2e/accessibility.spec.ts`: axe on the landing page, each status, and not-found, in both languages; no serious or critical issues (SC-007)
- [X] T039 [US3] Finalize the `check` script in `package.json`: typecheck, lint with no warnings, format check, i18n, styles, contracts, unit, end to end; fix anything it finds across the codebase
- [X] T040 [US3] Prove each rule fails by injecting and reverting violations: `any`, `@ts-ignore`, `ml-4`, a missing translation key, hard-coded JSX text, unformatted code, and a server-only import in a Client Component (build fails, FR-016); record the results below

**Checkpoint**: `pnpm check` is trustworthy.

---

## Phase 6: User Story 4 - Types from contracts (Priority: P2)

**Goal**: All contracts are snapshotted, with their source commit, generated types, and a refresh step.

**Independent Test**: Edit a contract and see the check fail; refresh from the backend checkout and see no differences.

- [X] T041 [US4] Implement `scripts/contracts-generate.mjs`: one LF-normalized `src/lib/api/generated/<contract>.ts` per contract; `--check` compares without writing, and names stale files
- [X] T042 [US4] Implement `scripts/contracts-refresh.mjs <path>`: rejects a dirty or invalid checkout; copies `specs/*/contracts/*.openapi.yaml` to `contracts/`; writes `contracts/SOURCE.json` with `repository`, `commit`, `copiedAt`; regenerates
- [X] T043 [US4] Run the refresh against the local backend checkout, read-only; confirm 11 files and commit `dff2dca`; commit-ready output in `contracts/` and `src/lib/api/generated/`; confirm T031's import still type-checks
- [X] T044 [US4] Prove `pnpm contracts:check` fails on an edited contract, then revert; prove a second refresh gives no differences (except `copiedAt`, which only changes when the commit changes); record below

**Checkpoint**: Every later feature can import contract types.

---

## Phase 7: User Story 5 - Setup from documentation (Priority: P3)

**Goal**: A new developer can follow the README, and bad configuration fails clearly.

**Independent Test**: Follow the README in a fresh copy; start with missing and invalid settings.

- [X] T045 [P] [US5] Write `e2e/live/health.spec.ts` and `playwright.live.config.ts`: real API through `.env.local`; "working" in both languages, and the check time in Cairo time
- [X] T046 [US5] Rewrite `README.md`: prerequisites, setup, configuration including port differences, running, testing, refreshing contracts
- [X] T047 [US5] Verify by following the README from a clean copy outside the working directory; run `pnpm test:e2e:live` against the Docker API; start with a missing `BACKEND_API_URL` and with `CLINIC_TIMEZONE=Mars/Base`, in both `next start` and `next dev`; record results and time taken below

**Checkpoint**: All stories work.

---

## Phase 8: Polish

- [X] T048 [P] Update `docs/tech-stack.md` with exact installed versions and research R8's changes
- [X] T049 [P] Update `docs/architecture.md` (Cache Components, actual layout, `i18n` path, `proxy.ts` rule), and note in `docs/decisions/0005-audit-safe-data-fetching.md` the effect-rerun rule from ADR 0006
- [X] T050 [P] Update `docs/development-guidelines.md` with commands and "don't clone the request in the proxy", and `CLAUDE.md` with commands and the bundled docs at `node_modules/next/dist/docs/`; keep the generated `AGENTS.md`
- [X] T051 Inspect built client output, and confirm the backend address and setting names are absent (SC-006)
- [X] T052 Run the full `specs/001-project-foundation/quickstart.md` validation and `pnpm check` a final time; record the real results below
- [X] T053 Run a code review of the phase's changes, fix what's found, and update `docs/roadmap.md`

---

## Dependencies & Execution Order

| Phase | Depends on |
|---|---|
| Setup | Nothing |
| Foundational | Setup; blocks all stories |
| US1 | Foundational |
| US2 | US1's landing page (T023); the first version of the generator (T030) |
| US3 | US1 and US2, as its checks need real code to run on |
| US4 | Foundational; T030 grows into T041 |
| US5 | US2, as the README describes a working status |
| Polish | All stories |

Within a story, tests come first and must fail before implementation.

## Parallel Example: User Story 2

```text
T026 classify-health tests · T027 instant tests · T028 view tests
T031 classify-health · T032 instant · T034 view and button
```

## Implementation Strategy

**MVP**: Setup, Foundational, and US1 give correct language and direction. **Phase goal**: US2 adds the end-to-end proof.
US3 to US5 then make the foundation enforceable and reproducible.

## Verification Results

Filled in during implementation with results that were actually observed.

| Task | Result |
|---|---|
| T040 | All nine rules failed when violated, and passed when reverted: `any`, `@ts-ignore`, hard-coded JSX text, `ml-4`, unformatted code, type error, missing translation key, edited contract, and a server-only import in a Client Component (`'server-only' cannot be imported from a Client Component module`). Swapping text direction failed 7 end-to-end tests |
| T044 | An edited contract failed `contracts:check`, naming `health.ts`. A second refresh from an unchanged backend gave no differences |
| T047 | From a clean copy of the shareable files, following the README: 40 seconds from install to a working page. Live tests: 2 of 2 against the Docker API on port 8081. Missing `BACKEND_API_URL` and `CLINIC_TIMEZONE=Mars/Base` both exit 1 in `next start` and `next dev`, naming the setting without its value |
| T051 | `.next/static` holds zero occurrences of the backend address or setting names |
| T052 | `pnpm check` passes in 69 seconds: 101 unit and component tests, and 41 end-to-end tests, stable over repeated runs. Pointing at phpMyAdmin on port 8080, and at a dead port, both show "Cannot reach the system" |
| T053 | Review raised 10 findings; all were fixed, with tests. Notably: check scripts silently passed under a symlink or junction, the style checker missed many styles, and the live region was replaced rather than updated |

## Deviations from the Plan

- ESLint 10 and Playwright 1.64.1 replace the planned versions, for the reasons in `docs/tech-stack.md`.
- T030 was satisfied by building the full generator early, rather than a partial one.
- `e2e/no-javascript.spec.ts`, `system-status-checking.tsx`, `validate-on-startup.ts`, and `[locale]/error.tsx` were added.
- Known limit: the language switch keeps the path and query string, but not a `#fragment`. Nothing uses fragments yet.
