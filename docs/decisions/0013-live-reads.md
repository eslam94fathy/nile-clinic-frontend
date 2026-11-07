# ADR 0013: Live reads, on the queue's pages only

**Status:** Accepted, by the project owner with Phase 7's plan, 2026-11-07

Builds on [ADR 0005](0005-audit-safe-data-fetching.md) and what [ADR 0011](0011-server-reads-and-refresh.md) left to this phase. See
[research](../../specs/007-queue/research.md), R1 to R5.

## Context

The queue must be current on several computers, and the API has no way to push changes, so screens must read by themselves
(hazard H3, roadmap decisions Q2 and Q4). Everything built so far reads once on the server, then refreshes after a change.

ADR 0005 described three kinds of query. Since then, ADR 0011 found that ordinary screens need no client cache, and ADR 0012 took
audited reads out of TanStack Query. Only the "live" kind is left to build.

## Decision

- Lists that must stay current read in the browser, through TanStack Query, under one `live` policy in `lib/api/live-query.ts`.
- **Only unaudited reads may use it.** At present those are `GET /queue`, `GET /doctors/{id}/queue`, and `GET /doctors/me/queue`.
  Each new use must be checked against the backend's audit list first.
- The provider sits on the pages that use it, not in the app's layout, so other pages don't carry the library.
- There's no server read of these lists, and so no hydration.
- A `403` or `404` removes the data and stops reading. Other failures keep the last list on screen with a notice, and reading continues.
- Actions keep the project's own pattern, not `useMutation`. They invalidate the lists afterwards, which also cancels a read in flight.
- A confirmation must sit above anything a refresh can remove.

The policy: every 15 seconds, not in the background, `staleTime` 0, one retry on no response or `5xx`, and `networkMode: "always"`, so a
browser reporting itself offline shows a failure rather than quietly pausing.

## Unmeasured at the time of writing

That polling stops on a page Next.js keeps hidden under `<Activity>` is expected, as hiding runs effect cleanups, but it hasn't been
measured. Phase 7 measures it before anything depends on it, and keeps that as a permanent test. If it doesn't hold, a `useLayoutEffect`
flag drives `enabled`, and this record is updated with what was found.

## Alternatives

| Option | Why not |
|---|---|
| `router.refresh()` on a timer | Re-renders the server page and its gate every 15 seconds, with an identity read each time. A failed refresh has no way to keep the last list with a notice |
| Own polling, of about 60 lines | Possible. But it would re-create request ordering, cancelling a read after a change, retrying, and the last-read time, which is what this library was approved for |
| A provider in the app's layout | Every page would carry the library for a feature on three of them |
| A server read, then a client takeover | Under Cache Components, `dehydrate()` reads the clock, so this needs a hand-built state, for a loading state lasting a moment |

## Consequences

- ADR 0005's "normal" kind stays unbuilt, and its "audited" kind stays as ADR 0012 has it. The policy module holds only what's used.
- A visible queue screen keeps a session alive indefinitely, which decision Q2 accepted.
- Sign-out and a `401` already do a full page load, which clears the cache, so nothing extra is needed for that.
- The list's first paint is a loading state, and the list needs JavaScript, as patient screens do.
