# Tasks: Role Dashboards

**Input**: Design documents from `specs/012-role-dashboards/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/api-usage.md](contracts/api-usage.md), [contracts/screens.md](contracts/screens.md), [quickstart.md](quickstart.md), [ADR 0019](../../docs/decisions/0019-dashboards-read-in-panels.md)

**Tests**: Required by the constitution (VIII) and the guidelines' testing table. Within a story, tests come first and must fail before the code that satisfies them is written.

**Organization**: By user story, in priority order. US1 (receptionist) and US2 (doctor) are both P1 and independent of each other; US3 (administrator) reuses US1's move panel; US4 (panel isolation) measures what the shared panel frame already does, across all three.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: The user story a task belongs to

## Rules for every task

- Check each API detail in [contracts/api-usage.md](contracts/api-usage.md) and the backend's contracts `006`–`010`. Never invent one.
- **Never request** `GET /patients/{id}`, `GET /doctors/me/encounters/{id}`, `GET /doctors/me/patients/{id}/encounters`, `GET /audit-entries`, or any non-`GET`. No row links to a patient or a record; no `PatientLink`, `RecordLink`, or `HistoryLink` on a dashboard.
- **Never read a second page.** A figure is `meta.total` from a read with `per_page=1`; a short list is `per_page=5`; the doctor's queue is the whole list the API returns.
- **One `useLiveList` per panel**, under `DASHBOARD_ROOT_KEY = ["dashboard"]`. Its `read` makes the panel's requests with `Promise.all` and returns one result: all succeeded, or the first refusal by `401` > `403` > `404` > other (research R3).
- **Receptionist and doctor panels use `LIVE_QUERY`; administrator panels use `ON_DEMAND_QUERY`** and pass `retriesBySelf={false}` to `LastRead`. No new policy.
- **Today is computed inside each `read`** with `clinicToday(timeZone)`, and returned with the figures (research R6, changed while implementing: not in the query key). `timeZone` is `getEnv().CLINIC_TIMEZONE`, passed from the server.
- **Money stays a string.** Never `Number()`, `parseFloat()`, or arithmetic on an amount; show through `Money`. Counts are integers from the API.
- **Branch only on status.** Never compare message text.
- Response bodies are checked with narrow Zod schemas, each `satisfies z.ZodType<Pick<Generated, …>>` against `src/lib/api/generated/*`. No phone is kept for listed rows.
- Other features are used only through `public.ts`. `Can` comes from `@/features/app-shell/public`.
- All text goes in both `src/messages/en.json` and `src/messages/ar.json`, with identical keys. Statuses reuse existing keys through `status-mapping`; unknown values are shown as sent.
- Names through `UserText`. Logical CSS only; colors only from tokens. No `any`. Test data is synthetic.
- Links use the app's `Link` with `prefetch={false}`.
- Tests use role queries. `getByLabel` needs `.locator("visible=true")` after a soft navigation, as hidden pages stay in the DOM.

---

## Phase 1: Setup

- [ ] T001 Confirm that `pnpm check` passes on the branch before any code change, and record the observed result in this file. If anything fails, stop and report it rather than working around it. **Partly observed on 2026-11-11, before any change:** typecheck, lint, format, i18n, styles, contrast, and contracts passed; unit tests 2105 of 2105; the e2e suite had passed 833 of 957 with none failing when Claude Code stopped the run for low system memory. The last 124 weren't run
- [X] T002 Confirm `pnpm contracts:check` reports the contracts up to date, and that `src/lib/api/generated/` exposes `AppointmentSummary`, `OwnAppointmentSummary`, `QueueEntry`, `OwnQueueEntry`, `QueueStatus`, `Visit` (encounters), `VisitCharge`, `MoneyCollected`, `MoneyFigures`, and `ActivityFigures`. No change is expected. **Observed:** `pnpm contracts:check` passed in the baseline run and in the owner's full `pnpm check`, and the dashboard's schemas type-check against these generated types without any change to them

---

## Phase 2: Foundational (blocks every story)

- [X] T003 [P] Create `src/features/appointments/public.ts` exporting `UPCOMING_DAYS` from `src/features/appointments/resolve-range.ts` (export the constant there, value unchanged at `90`). The appointments tests must pass unchanged
- [X] T004 [P] Create `src/features/dashboard/query-keys.ts` with `DASHBOARD_ROOT_KEY = ["dashboard"] as const`, and `src/features/dashboard/types.ts` with `Count`, `ShortList<Row>` (`{ rows: Row[]; total: number }`), and each panel's data type exactly per data-model.md
- [X] T005 [P] Write failing tests in `src/features/dashboard/schemas/dashboard.test.ts`, then create `src/features/dashboard/schemas/dashboard.ts`: `countPageSchema` (`{ data: unknown[], meta: { total: number } }`), `appointmentRowSchema` (`id`, `date`, `start`, `end`, `status`, `patient.full_name`, `doctor.name`; no phone), `ownAppointmentRowSchema` (`id`, `date`, `start`, `end`, `patient.full_name`), `ownQueueRowSchema` (`id`, `queue_number`, `status`, `called_at`, `patient.full_name`), `moneyTodaySchema` (`totals` and `by_method` with `received`, `refunded`, `net` as strings), and `activityTotalsSchema` (`appointments` by five statuses, `visits` by six keys, `no_show_rate: number | null`, `new_patients` optional). Each `satisfies z.ZodType<Pick<…>>` against the generated types. Test that a phone in the body is dropped and a numeric amount is refused
- [X] T006 [P] Write failing tests in `src/features/dashboard/first-refusal.test.ts`, then create `src/features/dashboard/first-refusal.ts`: `combine(results: ApiResult<unknown>[])` returning `{ ok: true, data }` when all succeed, otherwise the failure chosen by `401` > `403` > `404` > the first other. Cover each order
- [X] T007 [P] Write failing tests in `src/features/dashboard/links.test.ts`, then create `src/features/dashboard/links.ts` with each address in research R7: `/appointments?status=scheduled`, `/appointments?outside_availability=1`, `/appointments/{id}`, `/queue`, `/queue?status=…`, `/billing?charge_status=…`, `/my/queue`, `/my/appointments?status=scheduled`, `/my/appointments/{id}`, `/my/visits?from=…&to=…&record_status=none|draft`, `/reports/money-collected?from=T&to=T`, `/reports/activity?from=T&to=T`. Assert no address starts with `/patients/` or `/my/encounters` or `/my/patients`
- [X] T008 Write failing tests in `src/features/dashboard/api/dashboard.test.ts`, then create `src/features/dashboard/api/dashboard.ts` with one function per panel, each taking `(today, locale)` and using `browserApi`, `toQuery`, `checkResult`, and `combine`: `readTodaysAppointments`, `readQueueByStatus`, `readMoneyOwed`, `readNeedingAMove` (`to = addDays(today, UPCOMING_DAYS)`), `readOwnQueue`, `readNextOwnAppointments`, `readOwnRecords` (`from = addDays(today, -91)`), `readMoneyToday`, `readActivityToday`. Assert every request's path and query against contracts/api-usage.md rows 1–18, exactly (`per_page` 1 or 5, `outside_availability=1`, `charge_status` values `none`, `unpaid`, `partially_paid`); that one failing request fails the panel; and that no path in the module matches the "Never requested" list
- [X] T009 Add `dashboard.*` to `src/messages/en.json` and `src/messages/ar.json` per contracts/screens.md: panel headings, figure labels, empty sentences, `period` ("{from} to {to}"), `andMore` ("and {count} more"), link labels, `failed`, `tryAgain`, `profileNotFound`, and `onDemandNote`. Arabic in the owner's terminology from earlier phases. `pnpm check:i18n` must pass
- [X] T010 Write failing tests in `src/features/dashboard/components/dashboard-panel.test.tsx`, then create `src/features/dashboard/components/dashboard-panel.tsx`: a `section` labelled by its heading, an "Open …" link, children for figures and list, and `LastRead`; given a `LiveList`, it renders loading, shown, out of date, failed (with Try again calling `refresh`), forbidden (the shared `ForbiddenState`, unchanged), and not found (the shared `NotFoundState`, unchanged, or `dashboard.profileNotFound` when `doctorProfile`). No shared state component changes. Test each state in both directions
- [X] T011 [P] Write failing tests in `src/features/dashboard/components/figure-list.test.tsx`, then create `src/features/dashboard/components/figure-list.tsx`: a `dl` of label and count, each optionally a link; zero shown as `0`; numbers isolated left-to-right in Arabic with `LtrText`
- [X] T012 Change `src/app/[locale]/(app)/dashboard/page.tsx`: keep the welcome; inside `ScreenGate`, wrap `ScopedMessages` (namespaces `dashboard`, `status`, and those the panels reuse) and `LiveQueryProvider` around `DashboardForRole`, which picks `AdministratorDashboard`, `ReceptionistDashboard`, or `DoctorDashboard` from the current user's role and passes `timeZone`. Until each story lands, its dashboard renders nothing below the welcome. Update the comment that Phase 12 is to come

**Checkpoint**: `pnpm check` passes, `/dashboard` still shows the welcome for every role, and every other screen's tests pass unchanged.

---

## Phase 3: User Story 1 — The receptionist sees the desk's day at a glance (P1) 🎯 MVP

**Goal**: Four live panels for the receptionist: today's appointments, the queue by status, money owed today, appointments to move.

**Independent test**: Signed in as the receptionist with synthetic data for today, every figure equals the linked screen's count for the same filter, each link opens that screen with that filter, and no audited path is requested.

- [X] T013 [P] [US1] Write failing tests in `src/features/dashboard/components/receptionist-dashboard.test.tsx` for the four panels: figures and labels, the next 5 still to arrive with time, patient, and doctor, "and N more", each empty sentence, each link and row link, `<Can>` per panel (`manageAppointments`, `manageQueue`, `billing`), and `LIVE_QUERY` in use
- [X] T014 [P] [US1] Write failing tests in `src/features/dashboard/components/needing-a-move-panel.test.tsx`, then create `src/features/dashboard/components/needing-a-move-panel.tsx`: total, "today to {date}" with `ClinicDate`, the soonest 5 with date, time, patient, doctor, each linking to `/appointments/{id}`, and a `policy` prop (`LIVE_QUERY` or `ON_DEMAND_QUERY`)
- [X] T015 [US1] Create `src/features/dashboard/components/receptionist-dashboard.tsx` with `TodaysAppointments`, `QueueByStatus`, `MoneyOwed`, and `NeedingAMovePanel` (live), in a grid of one column at narrow widths and two at desk widths, until T013 and T014 pass
- [X] T016 [US1] Write `e2e/dashboard.spec.ts`'s receptionist journey against the fake backend, in `en` and `ar`: seed today's appointments in each status, queue entries in each status, visits uncharged, unpaid, partly paid, and paid, and one appointment outside availability with the fake's control endpoints; check each figure, follow each link and one row, and assert `callsTo` is 0 for every audited endpoint

**Checkpoint**: The MVP. `pnpm check` passes.

---

## Phase 4: User Story 2 — The doctor sees who is with them and who is next (P1)

**Goal**: The doctor's panels: with you now, waiting, later today, records to finish.

**Independent test**: Signed in as the synthetic doctor with one patient with them, three waiting, later appointments, and visits without a record and with a draft, each item matches My queue, My appointments, and My visits, and no encounter or patient read is made.

- [X] T017 [P] [US2] Write failing tests in `src/features/dashboard/components/doctor-dashboard.test.tsx`: the current patient (name, queue number, `called_at` through `Instant` in the clinic's zone) or "Nobody is with you"; the waiting count and every waiting patient in the API's order, with more than five waiting all shown (the spec's one exception to five rows); the next 5 appointments still to arrive with time and patient, each row linking to `/my/appointments/{id}`; the two record counts with "{from} to {to}" over 92 days and their links; no call-next, finish, or record button; `<Can>` per panel (`ownQueue`, `readOwnAppointments`, `medicalRecords`); a `404` showing `dashboard.profileNotFound`. "With you now" and "Waiting" share one read
- [X] T018 [US2] Create `src/features/dashboard/components/doctor-dashboard.tsx` with `WithMeNow` and `Waiting` (one `useLiveList` over `readOwnQueue`), `NextAppointments`, and `Records`, live, until T017 passes
- [X] T019 [US2] Add the doctor's journey to `e2e/dashboard.spec.ts`, in `en` and `ar`: seed the queue, appointments, and visits with the fake's control endpoints; check each item and link; check that the `newDoctor` account (no profile) sees the existing no-profile state and `callsTo` is 0 for every dashboard read; assert `callsTo` is 0 for `doctors/me/encounters/{id}` and `doctors/me/patients/{id}/encounters`

**Checkpoint**: `pnpm check` passes.

---

## Phase 5: User Story 3 — The administrator sees today's money and activity (P2)

**Goal**: Three on-demand panels: money today, activity today, appointments to move.

**Independent test**: Signed in as the administrator with synthetic payments, refunds, and activity today, every figure equals the Reports screen's for today, money exactly as sent, and nothing reads by itself.

- [X] T020 [P] [US3] Write failing tests in `src/features/dashboard/components/administrator-dashboard.test.tsx`: received, refunded, and net (a negative net shown as sent), received by method with translated method names, and a method without a translation shown as sent; "No money recorded today" at zero totals; appointments by status, visits by status, booked and walk-in, new patients, the no-show rate or "Not available" when `null`; the move panel; links to the two reports for today; `<Can capability="reports">`; `ON_DEMAND_QUERY` and `retriesBySelf={false}`; no receptionist desk panel
- [X] T021 [US3] Create `src/features/dashboard/components/administrator-dashboard.tsx` with `MoneyToday`, `ActivityToday`, and `NeedingAMovePanel` (on demand), using `Money` and the shared values in `src/components/shared/values`, with no import from `features/reports`, until T020 passes
- [X] T022 [US3] Add the administrator's journey to `e2e/dashboard.spec.ts`, in `en` and `ar`: seed payments by two methods, a refund, and activity; check each figure against the fake's report; follow both report links and check their period is today; check no read happens over two 15-second intervals of test clock until Refresh is pressed

**Checkpoint**: `pnpm check` passes.

---

## Phase 6: User Story 4 — The dashboard stays honest when part of it fails (P2)

**Goal**: Show, across the three dashboards, that one panel's failure, refusal, or not-found answer leaves the others working.

**Independent test**: With the fake backend scripting one panel's endpoint to fail, then `403`, then `404`, only that panel changes, and Try again reads only that panel.

- [X] T023 [US4] Add isolation tests to `e2e/dashboard.spec.ts` with `script(endpoint, status)`: for the receptionist's `queue`, `500` shows that panel's failed state while the others show figures, Try again reads only `queue` (by `callsTo`), and a later `500` after figures are shown keeps them with the out-of-date notice; `403` shows forbidden and stops reading over two intervals; for the doctor's `doctors/me/queue`, `404` shows `profileNotFound`; a `401` on any panel follows the session-end flow and returns to `/dashboard` after signing in
- [X] T024 [US4] Add reading-rhythm tests to `e2e/dashboard.spec.ts`: the receptionist's and doctor's panels read again after 15 seconds while visible and not while the tab is hidden or the person is on another page (following ADR 0013's measurements in `e2e/queue.spec.ts`); after a sign-out and sign-in as another role, only that role's panels appear, with no figure from before
- [X] T025 [US4] Add a unit test in `src/features/dashboard/api/dashboard.test.ts` with a fake clock crossing midnight in the clinic's zone: the next read sends the new date and uses a new query key

**Checkpoint**: `pnpm check` passes.

---

## Phase 7: Polish & cross-cutting

- [X] T026 [P] Add the dashboards to `e2e/accessibility.spec.ts`: each role's dashboard shown, one panel failed, one forbidden, and the doctor's empty state, in both directions and both themes, at narrow and desk widths, with no axe violations
- [X] T027 [P] Create `e2e/live/dashboard.spec.ts` per quickstart scenarios 1, 3, 5, and 9: for each role, compare every figure with the linked screen's count or the API's own total for the same filter, money as the same string; count audit entries for that account through `api("audit-entries?staff_id=<dashboard account>&per_page=100")` with **`auditAdmin`'s** token (never the dashboard account's own), taking the first count **after** signing in (signing in writes its own entry), then again after opening, pressing Refresh, and leaving the dashboard open for two intervals. `auditAdmin`'s searches have it as actor and no staff subject, so they can't match: expect **exactly zero** new entries for the dashboard account, of any action. For the administrator's dashboard, sign in as the live suite's ordinary administrator, not `auditAdmin`
- [X] T028 [P] Run `pnpm check:i18n`, and read the Arabic for the headings, figures, and empty sentences with the owner's terminology from earlier phases. **Done on 2026-11-11:** `pnpm check:i18n` passed in every `pnpm check`, and the owner read the Arabic and found it fine
- [X] T029 Update the documents in plan's "Documents to Update": `docs/architecture.md`, `docs/decisions/README.md` and ADRs 0013, 0015, and 0016 (a link forward to 0019), `docs/frontend-blueprint.md` (dashboards as built), `docs/backend-integration.md` (what the live suite confirmed), and `docs/roadmap.md` (Phase 12 status). Set ADR 0019's status when the owner accepts it. **Done on 2026-11-11 except the status:** every document listed is updated, with `docs/backend-integration.md`'s G3 recording the live run; the owner accepted ADR 0019 later the same day, and its status says so
- [X] T030 Run `pnpm check` and `pnpm test:e2e:live`, and record the observed results in this file. Report a failure rather than weakening a test. **Observed on 2026-11-11:** the owner's first `pnpm check` passed every static check and unit test, and 976 of 982 e2e tests; the 6 failures and their fixes are under "Changes made while implementing". After the fixes, Claude observed `e2e/dashboard.spec.ts` and `e2e/session-end.spec.ts` pass 117 of 117 over three repeats, and `e2e/navigation.spec.ts` 84 of 84 over three. The owner then reported a full `pnpm check` passing on 2026-11-11. Claude's `pnpm test:e2e:live` the same day passed 115 of 116, including the three dashboard tests; the failure, `e2e/live/auth.spec.ts` "an administrator setting a new password ends the session", had the same cause as the session-end tests and the same fix (see below). After it, `e2e/live/auth.spec.ts` and `e2e/live/dashboard.spec.ts` passed 15 of 15. The whole live suite hasn't been rerun in one pass since
- [X] T031 Run `/code-review` on the phase's changes, fix what's confirmed, re-run T030's checks, and record the result. Left for the owner by hand: SC-001's 5-second reading and a screen reader through one dashboard. **Review on 2026-11-11, eight findings.** Fixed six: the money schema now requires the contract's two-decimal text, as Reports' does; the doctor's queue read moved inside its `Can`; the administrator's links use the date the server rendered with (`today` from the page), not one computed while rendering; a linked figure's name is the message `dashboard.panel.figureName`, not a hard-coded separator; the `reports` text is sent only with the administrator's dashboard; and the duplicated-schema finding is answered by the money fix, as the narrow schemas themselves are research R5's decision. Not changed: "records to finish counts waiting patients" (`/doctors/me/visits` excludes them, H5, and the count is FR-010's), and "the panel's 401 branch can't run" (true today, as `browserApi` handles a 401, but every state handles 401 by the constitution, as `ApiFailureState` does). **Observed after the fixes:** typecheck, lint, format, i18n, and styles passed; the dashboard's 69 unit tests passed; `e2e/dashboard.spec.ts` 17 of 17; and the dashboard accessibility checks 16 of 16. A first combined e2e run failed 41 tests from the 155th on, across unrelated screens, because a `next dev` server started from the same folder removed the production build from `.next` mid-run; after rebuilding, the reruns above passed. After the commit, the owner reported a full `pnpm check` passing on 2026-11-11, once five Markdown files that a scripted edit had left with CRLF line endings in the working tree (not in the commit) were restored to LF. The owner then did SC-001's 5-second reading and a screen reader through one dashboard by hand, and accepted Phase 12 on 2026-11-11

---

## Changes made while implementing

- **Today is not in the query key** (research R6). Each read works out the clinic's date when it runs and returns it with the
  figures. A key that changed at midnight would replace a panel's figures with its loading state until the new read.
- **Refresh and Try again read only their own panel.** `useLiveList`'s refresh invalidates its root key, which the plan set to
  `["dashboard"]` for every panel; Refresh on one administrator panel would then have read all three, against US4. Each panel's
  own key, `["dashboard", <panel>]`, is now both its root and its query key's start (`use-panel.ts`).
- **`combine` became two functions**, `allSucceeded` (a type guard over the tuple of results) and `firstRefusal`, in
  `first-refusal.ts`, so that a panel's figures are read from narrowed results with no cast.
- **The reports feature gains a `public.ts`** exporting `Count`, `NoShowRate`, and `SignedMoney`, reversing T021's "no import from
  `features/reports`" (analysis A1). The administrator's figures then read exactly as Reports shows them: the rate's format, "Not
  available" for `null`, and a negative net said in words. Copying them would have made two versions to keep in step. The page
  passes the `reports` messages to the dashboard for them.
- **Figures reuse the owning screens' words** where they exist: the queue's statuses, and Billing's charge statuses ("No charge",
  "Unpaid", "Part paid"), so a figure and the filter it opens are named alike. The activity and money labels reuse Reports'.
- **A payment method and an own-queue status are read as strings**, not the contract's enums, so a value the frontend doesn't know
  is shown as sent rather than failing the panel (FR-014).
- **`left` is written `["left"]`** as an object key in four places, the project's way past the logical-styles check, as in
  `status-mapping.ts`: it's the queue's status, not a direction.
- **T027 counts with the setup administrator's token**, as `e2e/live/reports.spec.ts` does, not `auditAdmin`'s. For the receptionist
  and the doctor, its searches can't match their `staff_id`, so exactly zero new entries are expected. For the administrator's
  dashboard, signed in as that same administrator, the one new entry expected is the first count's own `audit.searched`.
- **Four existing e2e tests changed, as the landing page now reads by itself.** None of their assertions was weakened; each now
  starts where its premise holds:
  - `session-end.spec.ts`, "goes to sign-in on the next navigation" and "a session found to have ended in one leaves the other's
    screen": they ended the session on the dashboard, whose panels then found out before the click could, so the Queue link
    was gone. They now start from `/en/account`, which reads nothing by itself.
  - `navigation.spec.ts`, "a role that lost access is refused on the next navigation": the role changed while the dashboard was
    still streaming in, so its server render found the change and refreshed the shell before the click. The test now waits for
    the dashboard's three panels to have read. Its forbidden-state check also looks only at what's on screen, as the hidden
    dashboard can hold a refused panel of its own.
  - `e2e/live/auth.spec.ts`, "an administrator setting a new password ends the session": the same as the session-end tests,
    against the real API. It now opens `/en/account` after signing in, before the password is reset.
- **Three of the dashboard's own e2e tests were wrong, and were corrected:** the lapsed-session test scripted one endpoint's `401`,
  but the session-ended route asks the API first, found the session alive, and rightly returned to the dashboard; it now revokes
  the session, and also signs in again to see the dashboard return. The two reading-rhythm tests cleared the counts while first
  reads were still arriving; every count now starts once requests have been quiet for half a second (`quietThenClear`).
- **The accessibility suite's "landing page" check became three dashboard checks**: the desk's with one panel failed and one
  refused, at desk and phone widths; the doctor's with someone waiting and nobody with them; and the administrator's, empty.

---

## Dependencies and order

```text
Phase 1 → Phase 2 (T003–T011, then T012)
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
   US1 (desk) 🎯  US2 (doctor)  US3 (admin, needs T014 from US1)
         └───────────┼───────────┘
                     ▼
              US4 (isolation, all three)
                     ▼
                  Polish
```

- **US1 and US2 are independent**: different components and reads; both edit `e2e/dashboard.spec.ts`, one after the other.
- **US3 needs `NeedingAMovePanel`** (T014) from US1.
- **US4 measures all three dashboards**, so it comes after them.
- **The smallest useful slice**: Phases 1 to 3.

## Parallel examples

- Phase 2: T003, T004, T005, T006, T007, and T011 alongside each other; T008 after T005 and T006; T010 after T009; T012 last.
- US1: T013 alongside T014; then T015; then T016.
- US2 alongside US1's components: T017 then T018.
- US3: T020 once T014 is done.
- Polish: T026, T027, and T028.

## Implementation strategy

1. Finish Phases 1 and 2, confirming at the checkpoint that every existing screen behaves as before. Stop and report if it can't.
2. Build US1 for the MVP, running `pnpm check` at the end.
3. Add US2, US3, and US4, running `pnpm check` after each.
4. Run the live suite and review only once all stories are in.
