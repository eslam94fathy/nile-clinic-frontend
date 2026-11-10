# ADR 0016: Reports read on demand

**Status:** Accepted, by the project owner with Phase 10's plan, 2026-11-08

Extends [ADR 0015](0015-live-reads-beyond-the-queue.md). See [research](../../specs/010-reports/research.md), R1.

## Context

Phase 10's reports must say when their figures were read, offer reading them again, and keep the figures when a reread fails (spec FR-016,
FR-019). A server read refreshed by `router.refresh()` (ADR 0011) replaces the page with its error state when a reread fails. ADR 0015 built
the `onDemand` policy for Billing's other dates, which does exactly what reports need, but limited `LiveQueryProvider` to Billing and the
queue's pages.

## Decision

- The four `GET /reports/*` reads join those allowed in the browser under `ON_DEMAND_QUERY`. The backend's source confirms none writes an
  audit entry; the live suite confirms it.
- They never use `LIVE_QUERY`: no report reads by itself.
- `LiveQueryProvider` also sits on the reports page, with its own root key, `["reports"]`.
- Every other rule of ADRs 0013 and 0015 applies unchanged.

## Alternatives

| Option | Why not |
|---|---|
| Server reads under ADR 0011 | A failed reread would replace the figures; no read time without new code |
| Reports read live while they include today | Nobody asked for it, and figures changing under someone checking cash would mislead |

## Consequences

- Three pages now hold the provider. Any further use still needs its read checked against the backend's audit list.
- No new policy: `live-query.ts` is unchanged.
