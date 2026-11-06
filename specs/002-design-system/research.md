# Research: Design System

Findings come from throwaway spikes run on 2026-11-06 outside the repository: Next.js 16.4.5 production builds with shadcn
4.23.0, exercised with Playwright 1.64.1 in Chromium and axe, plus the documentation bundled in `node_modules/next/dist/docs/`
and <https://ui.shadcn.com/docs/rtl>. Only Chromium was tested. The spike code isn't kept.

## R1. Component foundation: shadcn, with Radix

**Decision**: shadcn `radix-nova` style with `rtl: true`, base library Radix.

**Evidence** (same keyboard script against an alert dialog and select on `/ar`, in production builds; the Radix page also held other spike components, so bundle sizes weren't compared):

| Check | Radix (`radix-ui` 1.8.1) | Base UI (`@base-ui/react` 1.9.0) |
|---|---|---|
| Alert dialog opens with focus on Cancel | Yes | Yes |
| **Tab stays inside the open alert dialog** | **Yes**: Cancel → Action → Cancel | **No**: reached a focus guard, then the page's link and trigger behind the dialog |
| Focus returns to the trigger on Escape | Yes | Yes |
| Dialog centered and `rtl` | Yes | Yes |
| axe on the open dialog | No issues | No issues |
| axe on the open custom select | **Serious**: `aria-hidden-focus` | No serious issues |
| Packages installed | 60 `@radix-ui/*` | 2 `@base-ui/*` |

**Rationale**: FR-030 requires focus to stay inside a dialog, and Base UI failed that in the spike. Radix's one serious finding is
on its custom select, which R2 avoids. The package count is Radix's real cost, and it's recorded here rather than dismissed.

**Limits of this evidence**: the Base UI result wasn't root-caused, and may be fixable with configuration. It should be retested
if the choice is ever revisited.

**Alternatives rejected**: Base UI, for the above. React Aria (`--base aria`) wasn't tested, as Radix already met the requirements.

## R2. Selects: native

**Decision**: Use shadcn's `native-select`, and don't install the custom `select`.

**Evidence**: `dir` is `rtl`, arrow keys change the value, height is 32 px, and axe reports no violations. It avoids R1's
`aria-hidden-focus` finding and needs no JavaScript from Radix.

**Trade-off**: The open list uses the operating system's look, so it can't be themed. That's acceptable for a staff tool, where
keyboard type-ahead matters more. A searchable list (say, for doctors) would be a new decision in the feature that needs it.

## R3. Generated code versus project rules

`shadcn init --rtl` works on an existing project. Generated code was checked against each project rule:

| Check | Result | Action |
|---|---|---|
| Logical-styles check | Passes; the CLI converts to `start-*`, `rtl:translate-x-1/2`, and so on | None |
| `tsc` with the project's strict settings | Passes | None |
| ESLint | Fails only on `dialog.tsx`: literal `Close` (`react/jsx-no-literals`) | Don't install `dialog`. `alert-dialog` has no such text |
| Prettier | 14 files fail | Run Prettier after each `add` |
| `sonner.tsx` | Imports `next-themes`, and uses an `as` cast | Rewrite against R5's theme code |
| `checkbox`, `separator` | Nothing specified needs them | Don't install (FR-028) |
| Target size | `xs` and `icon-xs` buttons are 24 px, the default 32 px | Meets the 24 px minimum |
| Raw colors (FR-003) | `alert-dialog.tsx:39` `bg-black/10`; `native-select.tsx:41,54` `bg-[Canvas]`, `text-[CanvasText]`; `button.tsx:15` `color-mix` of token variables | Replace `bg-black/10` with an `overlay` token. Allow the two system colors, which the OS-drawn list needs. The `color-mix` uses tokens only, so it's allowed |

**CLI side effects to correct**, because `init` writes floating `^` ranges and misplaces packages:

| Package | Change |
|---|---|
| All | Pin exact versions, as the project requires |
| `shadcn`, `tw-animate-css` | Move to `devDependencies`. They're needed only at build time, like `tailwindcss`. `shadcn` is kept for `shadcn/tailwind.css` and for adding components with a known CLI version |
| `next-themes`, `radix-ui` extras | Remove `next-themes` (R5) |
| `lucide-react` | Stay on 1.69.0, as 1.70.0 was published today (supply-chain policy) |

**`cn`**: the CLI now generates `import { cn } from "cn"`, replacing `clsx` and `tailwind-merge`. It's published by shadcn, has no
dependencies, and merged logical classes correctly in a spot check (`ms-2 ms-4` → `ms-4`; custom token colors; `px-2 ps-4` kept).
But it's pre-1.0 (0.5.2, published 2026-11-02). **Accepted, pinned exact**, since swapping to `clsx` and `tailwind-merge` later is a
mechanical change, while fighting the CLI would recur on every `add`.

## R4. Fonts: self-hosted from pinned packages

**Decision**: `next/font/local` pointing at `@fontsource-variable/*` files installed as pinned dev dependencies.

**Rationale**: `next/font/google` also self-hosts, but it downloads at build time, so a build needs network access to Google and
the files aren't pinned by the lockfile. Local files keep the build offline and under the supply-chain policy. All candidates are
licensed under OFL-1.1. Spike: Inter's Latin file is 48 KB and Noto Sans Arabic's Arabic file is 166 KB, and both loaded in production.

**Bug found and fixed.** With default settings, **Arabic text never loaded the Arabic font**. `next/font` adds a fallback with
Arial's metrics to the Latin family, and that fallback has Arabic glyphs, so the browser stopped there:

| Setting | Fonts loaded on an Arabic page |
|---|---|
| Default | `latin`, `latin Fallback`; Arabic web font never loads |
| `adjustFontFallback: false, fallback: []` on both | `latin`, `arabic` |

The stack is then `var(--font-latin), var(--font-arabic), system-ui, sans-serif`. A test must assert that the Arabic font really
loads, since Arabic still *renders* if it doesn't, in the wrong font, which is easy to miss.

**Cost**: without metric-adjusted fallbacks there may be a small layout shift while fonts load. Acceptable for an internal tool.

**Preloading**, checked during implementation: fonts are preloaded through the `Link` response header, not `<link>` tags in the HTML.

**The typefaces themselves are part of the visual direction proposal**, not decided here. Available as pinned packages: Inter,
IBM Plex Sans, Noto Sans, Source Sans 3, and Public Sans for Latin; Noto Sans Arabic, Cairo, and Readex Pro as variable Arabic
fonts; IBM Plex Sans Arabic in static weights only. Only Inter and Noto Sans Arabic were built in the spike.

## R5. Themes without flash: own code, no `next-themes`

**Decision**: About 40 lines of project code. A fixed inline script in `<head>` reads `localStorage` and `prefers-color-scheme` and
sets `data-theme` on `<html>`, following the bundled guide `preventing-flash-before-hydration.md`. A small client store holds the
choice for the switch and the notices.

**Evidence**:

| Situation | Result |
|---|---|
| No saved choice, dark device | `dark` |
| Saved `light`, dark device | `light` from the earliest check, and still after hydration |
| Storage access throws | No error; the page renders in the default theme |
| Console errors or hydration warnings | None |
| **Language switch, script only** | **`data-theme` lost**: the root layout's parameter changes, and the script doesn't run again |
| Language switch and back, with a layout effect re-applying the theme | Kept: `dark` throughout |

**Rationale**: The re-apply step is required, not optional. The guide mentions it only for development mode, but the spike shows
it's needed in production for this application's language switch. The script runs before paint, and doesn't make the shell dynamic,
which reading a cookie on the server would.

**Alternatives rejected**: `next-themes` 0.4.6 was last published in March 2025, and would be a dependency for what the bundled guide
shows in a few lines (constitution IX). A cookie read on the server would make every page dynamic, which the same guide warns against.

**Consequence for Phase 13**: a strict Content Security Policy must allow this script by hash or nonce. It's fixed text holding no
API data, so the guideline against `dangerouslySetInnerHTML` on API data isn't engaged.

## R6. Keeping the preview private

**Decision**: Two gates, both needed: `src/proxy.ts` for the status code, and a dynamic check inside the page for the content.

**Evidence** (production build, preview off, unless noted):

| Design | Result |
|---|---|
| Proxy rewrite only, static page | `404`, with the same response size as an unknown address. **But the content is written to prerendered files on the server** (`design-preview.rsc`, `.html`, and `.segments`), and URLs with a dot skip the proxy's matcher |
| Dynamic gate only (`connection()` inside `<Suspense>`) | Per the bundled docs, streaming has already started, so the status stays `200`: not the same as an unknown address |
| **Both** | `404` and same size as an unknown address. **No prerendered file holds the content.** `.rsc` and segment URLs return `200` without content, just as an unknown address's `.rsc` does. On with the flag: `200` with content |

**Rationale**: The dynamic gate also means the setting is read at runtime rather than frozen at build time, which matters because a
single build is tested in both states.

**Client chunks**: strings inside Client Components end up in `.next/static` whatever the setting. So demonstration text and
synthetic data stay in server code and translation files, and reach client pieces only as props while the preview is on. A
test searches the static output for a sentinel value.

**The proxy reads `process.env` directly**, as the bundled docs advise against sharing modules there. The setting is also added to
the startup schema, so an invalid value is reported.

## R7. Formatting values

All of this was run in Node 24.21 (ICU 78.3).

**Digits.** `Intl` with plain `ar` gives Western digits, but `ar-EG` gives Eastern ones, so the default can't be relied on. **Decision**:
one setting in `lib/format` appends `-u-nu-latn` to the locale, so a later change of mind is one line.

**Money.** `Intl.NumberFormat` accepts decimal strings exactly, and TypeScript's types allow it (`StringNumericLiteral`):

| Input | `en` | `ar` |
|---|---|---|
| `150.00` | `EGP 150.00` | `150.00 ج.م.` |
| `-1250.50` | `-EGP 1,250.50` | `-1,250.50 ج.م.` |
| `12345678901234567.89` | `EGP 12,345,678,901,234,567.89` | `12,345,678,901,234,567.89 ج.م.` |

Validate against the contracts' pattern before formatting: `SignedMoney`, `^-?\d+\.\d{2}$`, also covers `Money`.

**Bidirectional wrapping for money.** `Intl`'s Arabic output contains its own direction marks and places the currency after the
number for Arabic readers. So money is isolated from its surroundings (`<bdi>`) without forcing `dir="ltr"`, which would reverse that
order. Digits keep their order either way. Phone numbers, IDs, dates, and times do use `dir="ltr"`.

**Instants.** `new Date()` parsed both of the backend's spellings to the same moment in V8. But six fractional digits aren't in the
ECMAScript date format, so other engines may differ. **Decision**: validate with a strict pattern and truncate the fraction to three
digits before parsing.

**Dates and times** are validated and returned unchanged, never passed through `Date`:

| Kind | Pattern | Source |
|---|---|---|
| Date | `^\d{4}-\d{2}-\d{2}$`, plus month and day range checks | Contracts' `format: date` |
| Time | `^(([01]\d\|2[0-3]):[0-5]\d\|24:00)$` | Contracts' `^(([01][0-9]\|2[0-3]):[0-5][05]\|24:00)$`, deliberately without the five-minute rule, which is the backend's to enforce |

**Clinic time zone.** `CLINIC_TIMEZONE` is server-only, so `Instant` takes `timeZone` as a required prop. A provider waits for a second
real need, which the shell may supply in Phase 3.

## R8. Shared component text

**Decision**: Shared components use `useTranslations` and work in both server and client trees. The layout's
`NextIntlClientProvider` gains one small `shared` namespace, alongside the existing `error`.

**Rationale**: Later phases render these inside client lists fed by TanStack Query, so props alone would mean passing labels through
every screen. The namespace holds fixed labels only, never patient data. This extends the mechanism Phase 1 already uses for error pages.

## R9. Data table on narrow screens

**Decision**: Render a real table from 768 px up, and a list of cards below it, switching with CSS. Both come from one column definition.

**Rationale**: Restyling table elements as cards with CSS strips table semantics in some browsers. `display: none` removes the hidden
version from assistive technology. The cost is some duplicated markup. No table library is added: with no client sorting or filtering,
`@tanstack/react-table` still has no job here, as `docs/tech-stack.md` expected.

## R10. Filters apply on explicit submit

**Decision**: `FilterBar` is a form with Apply and Reset, not live per-keystroke filtering.

**Rationale**: Each change of a list's filters is a request. The roadmap already requires search on explicit submit for the audit log,
because each search is recorded, so one consistent behavior serves everywhere. Applying also resets to page one.

## R11. Checking contrast

**Decision**: Tokens are hex values in `globals.css`, and `scripts/check-contrast.mjs` reads both themes and checks a declared list of
text and background pairs. It joins `pnpm check`.

**Rationale**: FR-004 and SC-004 cover every pair, including those not on screen when axe runs. Hex needs only the WCAG formula, with
no color library. A reduced-opacity token can't be checked this way, so text tokens are solid colors.

## R12. Status values in the contracts

Verified in the generated types, for FR-019:

| Enumeration | Source | Values |
|---|---|---|
| Appointment | `appointments.ts:148` `Status` | `scheduled`, `cancelled`, `no_show`, `checked_in`, `completed` |
| Queue | `queues.ts:179` `QueueStatus` | `waiting`, `with_doctor`, `seen`, `left` |
| Charge | `payments.ts:220` `ChargeStatus` | `unpaid`, `partially_paid`, `paid`, `cancelled` |
| Visit's charge | `payments.ts:255` `charge_status` | Adds `none`, without `cancelled` |
| Record | `encounters.ts:144` `RecordStatus` | `none`, `draft`, `finalized` |

Each is available as a type, so the mapping is exhaustive at compile time with `satisfies Record<...>`.
