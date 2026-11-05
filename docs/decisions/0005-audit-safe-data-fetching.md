# ADR 0005: Query policy that protects the audit trail

**Status:** Accepted · **Date:** 2026-11-05

## Context

Some reads have side effects. Each successful call to these endpoints writes a permanent, unchangeable audit
entry saying that a person opened the record:

| Endpoint | Entry |
|---|---|
| `GET /patients/{id}` | `patient.opened` |
| `GET /doctors/me/encounters/{id}` | `encounter.opened` |
| `GET /doctors/me/patients/{id}/encounters` | `encounter.history_viewed` |
| `GET /audit-entries`, for every page | `audit.searched` |

By default, TanStack Query refetches on window focus, reconnect, and remount, and retries failures. Next.js
can prefetch links. Used as they come, an idle tab regaining focus would record a person opening a medical
record they didn't open again. In an audit trail, that's false evidence.

## Decision

Every query belongs to one of three kinds. The policy lives in one module, so a query states its kind rather
than repeating options.

| Kind | `staleTime` | Refetch on focus, reconnect, or mount | Retry | Polling |
|---|---|---|---|---|
| **Live**, e.g. queue | 0 | Yes | Yes | Only while the tab is visible |
| **Normal**, e.g. lists, reference data | Short | Default | Yes, not on `4xx` | No |
| **Audited**, the table above | Infinity | **No** | **No** | **Never** |

Further rules for audited reads:

- They run only because a person opened that record. Links to them set `prefetch={false}`.
- A record is fetched once per opening, either on the server or the client. A server fetch mustn't be repeated
  by the client, and must be hydrated into the query cache if a client query uses it.
- After a mutation, use the record the API returned rather than fetching again. `PATCH /patients/{id}` and
  `PUT` on an encounter both return the updated record.
- Refreshing is an explicit action by the person. It does record another opening, which is true.
- Audit searches run when submitted, not while typing.

For all kinds: the cache is in memory only, is never persisted, and is cleared at sign-out and on `401`.
Mutations never retry automatically.

## Alternatives

| Option | Why not |
|---|---|
| Disable refetching globally | Would make queue and other screens stale, and doesn't handle prefetch or double fetches |
| Fetch audited records outside TanStack Query | A second data path for the same features; retry and focus bugs simply move elsewhere |
| Ask the backend to record only some reads | Would weaken a deliberate audit rule. Not the frontend's call |

## Consequences

- Cache Components keeps visited routes mounted but hidden, and re-runs their effects when shown again
  ([ADR 0006](0006-cache-components.md)). So an audited read must never start from a bare `useEffect`, and Phase 5 must test going
  back to a patient page.
- A long-open record may be out of date. This is acceptable: drafts are visible only to their author, finalized
  records can only gain addenda from their author, and a person can refresh.
- React's Strict Mode double-invokes effects in development, which can double-fetch and create extra entries in
  the **development** audit trail. This must be checked in Phase 5 and not mistaken for a production fault.
- Tests must prove that focus and re-render don't refetch audited queries. Backend entries can confirm it in
  Playwright by searching the audit trail after a journey.
- Each new endpoint must be checked against the backend's audit list, as in the
  [guidelines](../development-guidelines.md#data-fetching).
