# ADR 0006: Adopt Next.js Cache Components

**Status:** Accepted · **Date:** 2026-11-05

Decided during Phase 1 planning, under the approved stack, and tested with a production spike. See
[research R1](../../specs/001-project-foundation/research.md).

## Context

Next.js 16.4's `create-next-app` enables `cacheComponents` and `partialPrefetching`. Its documentation says both will be
enabled everywhere in the next major release. With them on, pages are prerendered as a static shell, dynamic content
streams into it, and nothing is cached unless code says `use cache`. Next.js also keeps recently visited routes mounted
but hidden, rather than unmounting them.

## Decision

Enable both options.

Rules that follow:

1. **`use cache` must never wrap per-user, patient, or clinical data.** Shared caching of those would be a privacy failure.
   It may be used only for public, non-personal content, and only with a reason.
2. **Static shells must not contain personal data.** Dynamic data stays inside `<Suspense>`.
3. **Audited reads stay under ADR 0005.** Partial prefetching fetches only the static shell, so it doesn't run dynamic reads.
   However, `prefetch={true}` could resolve more, so `prefetch={false}` is still required on links to audited records.
4. **Hidden routes re-run effects when shown again.** An audited read must never be triggered from a bare `useEffect`.
   `refetchOnMount: false` and `staleTime: Infinity` from ADR 0005 cover this, and Phase 5 must test it, including going back
   to a patient page.
5. **Sign-out must not leave hidden patient screens mounted.** Sign-out performs a full page navigation, which clears them,
   and Phase 3 must test this.

## Alternatives

**Leave it off.** It's simpler today and behaves the same for routing and 404s in testing, but only delays a required
migration, and later features would be written against the older model.

## Consequences

Static shells make first paint fast, and the first bytes hold `<html lang dir>`. The cost is a newer model with more rules,
particularly the Suspense placement required around dynamic data, which the build enforces. The keep-mounted behavior adds a
privacy consideration that the two rules above address.
