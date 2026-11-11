# ADR 0018: The audit search reads only on a press

**Status:** Accepted, by the project owner with Phase 11's plan, 2026-11-10

Starts from [ADR 0012](0012-audited-reads-in-the-browser.md), as it asks. See [research](../../specs/011-audit-log/research.md), R1 to R3.

## Context

Every request to `GET /audit-entries`, each page included, writes a permanent `audit.searched` entry naming the administrator and the
filters. A search the person didn't ask for is false evidence about them. ADR 0005 says audit searches run when submitted, not while typing.

ADR 0012's guarded read, `useAuditedRead`, is for a record that is read because it was opened: its effect reads on mounting, and a mark
tells a click from the back button. A search is never started by opening the page (clarification 2), and its filters must stay out of the
address (clarification 1), so neither the effect nor the mark has anything to do.

## Decision

- **The search reads only inside the handler of a person's press**: Search, Older, Newer, Try again, Start again. No effect reads, no query
  library is used, nothing is cached.
- **One request per press**: a ref is set before the request and checked first, as well as disabling the buttons.
- **The results and the filters sent live in the component's state only.** Cache Components keeps the page while hidden, so going back
  shows them again without a read. A reload, a new tab, or a language switch starts empty.
- **Paging reuses the filters as sent**, with the API's cursor, never the form's current values.
- **Retrying is always a press.**

## Alternatives

| Option | Why not |
|---|---|
| `useAuditedRead` | Built for openings by id; an effect that reads is the very risk to avoid here |
| TanStack Query, refetching off | Nothing for it to do, as ADR 0012 found for audited reads |
| Filters in the address, filling the form only | Patient numbers in history and logs; rejected in clarification 1 |
| A server read | Needs the address, and a refresh would repeat it |

## Consequences

- A reload loses the search. That's intended: it can't repeat it.
- No effect in the audit feature may call the API. A unit test checks that mounting, re-rendering, Strict Mode, and being shown again read
  nothing, and `e2e/live/audit.spec.ts` counts real entries.
- `CursorPager` becomes a shared component, with one consumer.
