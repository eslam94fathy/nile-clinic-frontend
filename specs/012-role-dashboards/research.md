# Research: Role Dashboards

**Feature**: 012-role-dashboards | **Date**: 2026-11-11

## Facts, checked in the backend and this codebase

From the backend's contracts at commit `dff2dca` (`006`, `007`, `008`, `009`, `010`) and this repository's existing reads.

- **Every read used is unaudited**, and each is already used by an earlier phase: `GET /appointments` (Phase 6, server), `GET /queue` and
  `GET /doctors/me/queue` (Phase 7, live), `GET /doctors/me/visits` (Phase 8, server and live), `GET /visits` (Phase 9, live),
  `GET /doctors/me/appointments` (Phase 6, server), `GET /reports/money-collected` and `GET /reports/activity` (Phase 10, on demand). The
  live suites of Phases 6–10 confirm none writes an entry ([backend-integration](../../docs/backend-integration.md)).
- **Filters used**, all in the contracts: appointments `from`, `to` (required, 92 days at most), `status` (one value), `outside_availability`
  (boolean); `/queue` `status` (one value), no date (always today); `/visits` `date` (required), `charge_status` (`none`, `unpaid`,
  `partially_paid`, `paid`); `/doctors/me/visits` `from`, `to` (required, 92 days), `record_status` (`none`, `draft`, `finalized`);
  `/doctors/me/appointments` `from`, `to`, `status`; reports `from`, `to` (366 days). Every paged list takes `per_page` 1–100.
- **`meta.total` is a number** on every standard page (confirmed live in Phase 3). `/doctors/me/queue` isn't paged: its `data` is the whole
  list.
- **No grouped count exists** (gap G3). One status means one read.
- **`outside_availability=true`** returns only scheduled, not-started appointments outside current availability. The Appointments screen's
  "needing a move" list reads today to today + 90 (`features/appointments/resolve-range.ts`, `UPCOMING_DAYS`).
- **My visits' default period is 30 days** (`features/encounters/read-visit-filters.ts`). The dashboard's records panel covers 92, so its
  links state `from` and `to` explicitly.
- **Doctor without a profile**: `ScreenGate` already checks `GET /doctors/me` for `dashboard` (`needsDoctorProfile`), so no panel renders.
  A profile removed mid-session makes `/doctors/me/*` answer `404`, which `useLiveList` treats as stop-and-clear.
- **No general rate limit** on authenticated routes in the backend (only sign-in and password changes are throttled).
- **Target screens already read their filters from the address**: Appointments (`from`, `to`, `status`, `outside_availability`), My
  appointments (`from`, `to`, `status`), Queue (`status`), Billing (`date`, `charge_status`; date defaults to today), My visits (`from`,
  `to`, `record_status`), Reports (`from`, `to`). No target screen needs a change for a link.

## R1 — How panels read

- **Decision**: In the browser through `useLiveList` and `LiveQueryProvider`, on the dashboard page, with the dashboard's own root key
  `["dashboard"]`. The receptionist's and the doctor's panels use `LIVE_QUERY`; the administrator's use `ON_DEMAND_QUERY`. Recorded as
  [ADR 0019](../../docs/decisions/0019-dashboards-read-in-panels.md).
- **Rationale**:
  - The owner's clarification: desk and doctor panels live like the queue, the administrator's like Reports.
  - `useLiveList` already gives everything a panel needs: a failure keeps the last figures with a notice (FR-015), `403`/`404` clears and
    stops (US4), read time for `LastRead` (FR-007), and no reading while hidden (ADR 0013's measurements).
  - A server read then `router.refresh()` (ADR 0011) can't read itself, and a failure replaces the page, which breaks FR-006.
- **Alternatives**: Server Components per panel inside `<Suspense>` (independent loading, but no live reading and no kept figures on a failed
  reread); a new polling hook (duplicates `useLiveList`).

## R2 — How a figure is counted

- **Decision**: A figure for one filter is one read with `per_page=1`, using `meta.total`. A panel's short list is one read with
  `per_page=5`, using its rows and `meta.total` for "and N more". The doctor's queue is counted from the whole list the API returns. Report
  figures are the report's totals.
- **Rationale**: FR-005 forbids reading every page. `per_page=1` makes each count's answer one row, so it costs little.
- **Request budget** (per open, and per 15 seconds while visible, for live panels):

  | Dashboard | Reads | Of which |
  |---|---|---|
  | Receptionist | 12 | appointments 4 (still to arrive, with 5 rows; arrived; completed; no-show), queue 4, visits 3, needing a move 1 (with 5 rows) |
  | Doctor | 4 | own queue 1, own appointments 1 (5 rows), own visits 2 (no record, draft) |
  | Administrator | 3, on demand | money collected 1, activity 1, needing a move 1 |

  About 0.8 requests a second for an open receptionist dashboard, through the BFF. The backend has no general rate limit. Acceptable for a
  clinic's few desks; listed under Risks.
- **Alternatives**: Read one page of 100 and count rows by status (wrong once a day passes 100, and a page isn't a total); the activity
  report for the receptionist (refused: reports are administrator-only).

## R3 — One query per panel

- **Decision**: Each panel is one `useLiveList` whose `read` makes its several requests together and succeeds only if all do. If any fails,
  the panel fails as one, with the highest-priority refusal (`401` > `403` > `404` > other).
- **Rationale**: FR-006 asks panels, not figures, to be independent. A panel half-updated would show figures read at different times beside
  one "last read" time. One query per panel also gives one `LastRead` per panel.
- **Alternatives**: One query per figure (12 notices for the receptionist; figures inconsistent within a panel); one query for the whole
  dashboard (breaks FR-006).

## R4 — Where the code lives

- **Decision**: A new feature, `features/dashboard`, with its own API module, `api/dashboard.ts`, and narrow Zod schemas for only the fields
  it shows, each `satisfies z.ZodType<Pick<Generated, …>>` against the generated types. It imports from other features only through their
  `public.ts`: the appointments feature gains a `public.ts` exporting `UPCOMING_DAYS` (so the move panel's period can't drift from the
  screen's). Statuses and methods are translated through the shared `status-mapping` and existing message keys, so no other
  feature's code is imported. Money and the no-show rate use the shared values in `components/shared/values`, not the reports
  feature's components.
- **Rationale**: Other features' reads use `per_page=100` and full schemas, and appointments reads only on the server. Exporting and
  parametrising each would couple five features to the dashboard. `features/encounters` already holds a narrow list schema for the same
  reason (`todaysListSchema`).
- **Alternatives**: Exporting each feature's read through `public.ts` (five features change for one consumer; per-page sizes differ);
  putting the panels in each feature (the dashboard's choices would be spread across five features).

## R5 — Which dashboard

- **Decision**: The page already reads the current user on the server for the welcome. It renders the role's dashboard component inside the
  provider: `AdministratorDashboard`, `ReceptionistDashboard`, or `DoctorDashboard`. Each panel is also wrapped in `<Can>` with the capability
  it reads under (`manageAppointments`, `manageQueue`, `billing`, `ownQueue`, `readOwnAppointments`, `medicalRecords`, `reports`), so that
  the permissions map remains the one place (FR-001, FR-002).
- **Rationale**: The role is known before any panel renders, so no panel reads under the wrong role. A role changed mid-session shows each
  panel's forbidden state on its next read, as the spec says, until a reload.

## R6 — Today

- **Decision**: Each `read` computes today with `clinicToday(timeZone)` when it runs, and returns the date it read for with its
  figures, so the first read after midnight uses the new date. The date isn't in the query key: a key changing at midnight would
  show a loading state in place of figures until the new read. `timeZone` is `CLINIC_TIMEZONE`, passed from the server as other
  live pages do. (Changed while implementing; the plan had the date in the key.)
- **Rationale**: Edge case "Today". Computing it once at render would read yesterday all night on a page left open.

## R7 — Links

| Panel | Link | Row link |
|---|---|---|
| Today's appointments (R) | `/appointments?status=scheduled` (range defaults to today) | `/appointments/{id}` |
| Queue (R) | `/queue`, and each count to `/queue?status=…` | none |
| Money owed (R) | `/billing?charge_status=…` (date defaults to today) | none |
| Needing a move (R, A) | `/appointments?outside_availability=1` (range defaults to today + 90) | `/appointments/{id}` |
| With me now, Waiting (D) | `/my/queue` | none |
| Next appointments (D) | `/my/appointments?status=scheduled` (range defaults to today) | `/my/appointments/{id}` |
| Records (D) | `/my/visits?from=…&to=…&record_status=none` or `draft` | none |
| Money (A) | `/reports/money-collected?from=today&to=today` | none |
| Activity (A) | `/reports/activity?from=today&to=today` | none |

- No link goes to a patient or a record, and no row is a `PatientLink` (FR-012). Every target is an unaudited page; links use the app's
  `Link` with `prefetch={false}`, as other list rows do.

## R8 — Display

- Counts are integers shown with the app's number formatting (Western digits, ADR 0008). Money uses the shared `Money` value, as sent. The
  no-show rate uses Reports' value, "Not available" when `null`. Statuses reuse the existing `status.*` translations through
  `status-mapping`; text labels sit beside every figure, never color alone (FR-014).
- Times: appointment `start` as sent; queue `called_at` as an instant in the clinic's time zone through `Instant`.
- Names through `UserText`, never translated.

## R9 — Testing

- **Unit** (Vitest, Testing Library): each read's query (filters, `per_page`, today); each panel's loading, empty, success, failure, out of
  date, forbidden, and not-found; a panel failing alone; the role switch; links and their queries.
- **End to end** (Playwright, fake backend): each role's dashboard in both locales; one panel's read failed, refused, or not found through
  `page.route` while others show figures; live panels reading again after 15 seconds and not while hidden; the administrator's panels not
  reading by themselves; axe on each state.
- **Live** (`pnpm test:e2e:live`): for each role, every figure equals the linked screen's count for the same filter; reading the dashboard,
  pressing Refresh, and leaving it open for two intervals writes no audit entry (checked by the administrator's audit search before and
  after, counted as other live suites do).
