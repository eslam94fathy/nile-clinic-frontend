# ADR 0015: Live reads beyond the queue, and reads on demand

**Status:** Accepted, by the project owner with Phase 9's plan, 2026-11-08

Extends [ADR 0013](0013-live-reads.md). See [research](../../specs/009-billing-payments/research.md), R1 and R2.

## Context

ADR 0013 limited reading by itself to the queue's pages. Phase 9's owner decision is that Billing reads every 15 seconds while it shows the
clinic's today, so that arrivals appear at the desk, and doesn't read by itself for any other date. Billing is the second real consumer
of the pieces Phase 7 built inside `features/queue`.

## Decision

- `GET /visits` joins the reads allowed to use the `live` policy. The backend's source confirms it writes no audit entry.
- `lib/api/live-query.ts` gains an `onDemand` policy for a list that reads in the browser but never by itself: no interval, no reading on
  window focus or reconnect, no retry of a `4xx`. It's used by Billing for any date but today, so that one table has one way of reading.
- `useLiveList`, `LiveQueryProvider`, `LastRead`, `useKeepFocus`, and `groupByDoctor` move out of `features/queue` to `lib` and
  `components/shared`, with no change of behavior. `useLiveList` takes the root key that its refresh invalidates, so each feature
  refreshes only its own lists.
- The provider sits on the Billing page as well as the queue's pages, and still nowhere else.
- Every rule of ADR 0013 still applies: only unaudited reads, a `403` or `404` stops reading and clears the data, a failed read keeps the
  last list with a notice, actions refresh afterwards, and a notice or confirmation sits above anything a refresh can remove.

## Alternatives

| Option | Why not |
|---|---|
| A server read for dates other than today | Two ways of reading one table, switched by the date, with different states and refresh paths |
| Importing the queue's pieces through its `public.ts` | Billing would depend on the queue, and a Billing action would refresh the queue's lists |
| Billing live on every date | Earlier dates rarely change, so most reads would be wasted. The owner chose today only |

## Consequences

- A visible Billing page for today keeps a session alive, as the queue already does, under decision Q2.
- `live-query.ts` now holds two policies, both in use. ADR 0005's "normal" kind stays unbuilt.
- The queue's tests move with the pieces they test, so the behavior Phase 7 measured stays measured.
- [ADR 0016](0016-reports-read-on-demand.md) later puts Phase 10's reports under the `onDemand` policy too.
