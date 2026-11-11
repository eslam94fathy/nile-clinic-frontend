# ADR 0019: Dashboards read in panels, live for the desk and doctors, on demand for administrators

**Status:** Accepted, by the project owner after Phase 12's review, 2026-11-11

Extends [ADR 0013](0013-live-reads.md), [ADR 0015](0015-live-reads-beyond-the-queue.md), and
[ADR 0016](0016-reports-read-on-demand.md). See [research](../../specs/012-role-dashboards/research.md), R1 to R3.

## Context

Phase 12's dashboards summarise five modules on one page, with no summary endpoint (gap G3). The owner decided that the receptionist's and
the doctor's panels read every 15 seconds while visible, like the queue, and the administrator's only when opened or asked, like Reports.
One panel's failure must not affect another's (spec FR-006). `LiveQueryProvider` is limited to the pages ADRs 0013, 0015, and 0016 name.

## Decision

- The dashboard page holds `LiveQueryProvider`, with the root key `["dashboard"]`.
- These reads join those allowed in the browser: `GET /appointments` and `GET /doctors/me/appointments` (newly), and `GET /queue`,
  `GET /doctors/me/queue`, `GET /doctors/me/visits`, `GET /visits`, `GET /reports/money-collected`, `GET /reports/activity` (already
  allowed). None is audited, as each earlier phase's live suite confirms.
- The receptionist's and doctor's panels use `LIVE_QUERY`; the administrator's use `ON_DEMAND_QUERY`. No new policy.
- **Each panel is one query**, whose read makes its requests together and fails as one. A figure is a list's `meta.total` with
  `per_page=1`; a short list is `per_page=5`. No panel reads a second page.
- `features/dashboard` has its own read module and narrow schemas, rather than exporting other features' reads.
- Every rule of ADRs 0013, 0015, and 0016 applies unchanged.

## Alternatives

| Option | Why not |
|---|---|
| Server Components per panel, refreshed with `router.refresh()` | No live reading; a failed reread replaces the figures |
| One query per figure | Twelve notices and read times on the receptionist's page; figures in one panel read at different moments |
| One query for the whole dashboard | One failure would blank every panel |
| Counting rows of one 100-row page per list | Wrong once a list passes 100; a page isn't a total |
| Exporting each feature's read for the dashboard | Five features change for one consumer, and their page sizes differ |

## Consequences

- Four pages now hold the provider. Any further use still needs its reads checked against the backend's audit list.
- An open receptionist dashboard makes 12 small reads every 15 seconds (about 0.8 a second) and keeps the session alive, as the queue does,
  under decision Q2. The backend has no general rate limit.
- Figures and their linked screens agree only while the dashboard's filters match the screens' defaults; the move panel's period is
  imported from the appointments feature so it can't drift.
