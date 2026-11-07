# ADR 0011: Server reads, then refresh, with no client cache yet

**Status:** Accepted, by the project owner with Phase 4, 2026-11-06

Decided during Phase 4 planning and tested with a production spike against the real backend. See
[research](../../specs/004-clinic-setup/research.md), R1. This builds on [ADR 0005](0005-audit-safe-data-fetching.md) and
[ADR 0006](0006-cache-components.md).

## Context

The architecture planned for Client Components to read through TanStack Query, added with the first client query. Phase 4's
screens read data and change it, but nothing on them polls, or needs to read from the browser.

The open question came from ADR 0006: visited routes stay mounted but hidden. A list opened before a change might show old data
when someone returned to it, which would break the spec's FR-037.

## Decision

- Pages read in Server Components, through `serverApi`.
- Client Components change data through a feature's API module and `browserApi`, then call `router.refresh()`. A form that moves
  to another page calls `router.push()`, then `router.refresh()`.
- `@tanstack/react-query` stays uninstalled until the queue's polling in Phase 7.

**Evidence.** A server-rendered count on two pages, a client button changing a specialty's status, and the real API. A page opened
before the change showed the new value at once, whether reached by a link or by the back button. The earlier page was confirmed
to be in the DOM throughout. `e2e/clinic-roles.spec.ts` keeps this as a permanent test, including a form that moves to another page.

## Consequences found by testing

Hidden pages keep their state as well as their data, which matters more than the refresh question did:

- **What's typed stays in a hidden page.** A password stayed in the new account form after it was submitted. Forms that move on
  now call `reset()`.
- **A password typed and never submitted is wiped on leaving the form,** by `useClearOnLeave`, as React runs an effect's cleanup
  when a page is hidden. This is the owner's decision for shared reception computers. Other fields keep what was typed.
- **Tests can find two copies.** `getByRole` skips hidden content, and `getByLabel` doesn't. Use `.locator("visible=true")` with
  `getByLabel` after any soft navigation.
- **Fields need `defaultValue` from the server.** React Hook Form sets values only after hydration, so a field was empty until
  then, and typing in that moment saved a merged value.

## Alternatives

| Option | Why not |
|---|---|
| Install TanStack Query now | Nothing in Phase 4 polls or reads from the browser. Principle IX says a dependency waits for a feature that needs it |
| Full page reloads after each change | Loses the notice and scroll position, and is slower at a reception desk |
| Server Actions with `refresh()` from `next/cache` | A second path to the API beside the same-origin route, which already holds the origin and path checks |

## When to revisit

If `router.refresh()` stops reaching hidden pages in a later Next.js version, the permanent test fails. Phase 7 added TanStack Query
for polling only ([ADR 0013](0013-live-reads.md)), and this flow stays for everything else.
