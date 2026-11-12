# ADR 0007: Design system foundation

**Status:** Accepted, 2026-11-06. Evidence is in the Phase 2 [research](../../specs/002-design-system/research.md).

## Context

Phase 2 needed accessible components that work in both directions, themes without a flash, self-hosted fonts in two scripts, and a
preview that stays private when no authentication exists yet. These were settled by production-build spikes in Chromium.

## Decision

**shadcn on Radix (`radix-nova`, `rtl: true`).** In the spike, Radix's alert dialog kept keyboard focus inside the modal, and Base UI's
didn't, reaching the page behind it, which FR-030 forbids.

**Native selects.** Radix's open custom select drew a serious `aria-hidden-focus` finding from axe, and the native one had none. The open
list uses the operating system's look.

**Our own theme code, about 40 lines.** A fixed inline script sets `data-theme` before paint, as the bundled Next.js guide shows, and a
layout effect re-applies it, because a language switch otherwise loses it in production.

**Fonts from pinned packages, through `next/font/local`.** Builds stay offline, and the lockfile pins the files. Both fonts need
`adjustFontFallback: false, fallback: []`, or Arabic text stops at the Latin font's Arial-metric fallback and the Arabic font never loads.

**A preview with two gates.** `proxy.ts` gives the `404`, and a dynamic check inside `<Suspense>` keeps content out of prerendered files.
Neither one alone is enough: the proxy alone leaves content on the server's disk, and the dynamic check alone returns `200`.

## Alternatives

- **Base UI:** 2 packages against Radix's 60, and no axe finding on its select, but it failed the focus test. **Retest this if the choice
  is revisited:** the failure wasn't root-caused, and may be fixable with configuration.
- **React Aria:** not tested, as Radix met the requirements.
- **`next-themes`:** a dependency for what the bundled guide shows in a few lines, last published in March 2025.
- **A theme cookie read on the server:** makes every page dynamic.
- **`next/font/google`:** also self-hosts, but needs Google at build time, and isn't pinned by the lockfile.

## Consequences

- `radix-ui` installs 60 packages. This is a known cost, under the lockfile and release-age policy.
- `cn` is what the CLI now generates, and is pre-1.0. It's pinned, and replacing it with `clsx` and `tailwind-merge` is mechanical.
- A strict Content Security Policy in Phase 13 must allow the theme script by hash or nonce. **Amended by
  [ADR 0021](0021-security-headers.md):** neither can cover the streamed scripts while pages stay prerendered, so the policy allows
  inline scripts, and keeps everything else strict.
- After each `shadcn add`, run `pnpm format`, and expect the project's checks to catch what the CLI generates against project rules.
- Evidence comes from Chromium only. Cross-browser checks belong to Phase 13.
