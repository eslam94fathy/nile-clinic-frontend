# Feature Specification: Role Dashboards

**Feature Branch**: `012-role-dashboards`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "Start Phase 12" of `docs/roadmap.md`: role dashboards. Replace the simple welcome at `/dashboard` with a role-specific home for administrators, receptionists, and doctors, composed only from endpoints Phases 4–11 already use, as the API has no summary endpoint (gap G3). Draft content from `docs/frontend-blueprint.md`: administrator, today's money collected and activity, and upcoming appointments outside availability; receptionist, today's appointments and arrivals, the queue by status, unpaid visits, and appointments needing a move; doctor, the patient with them now, the waiting count, the next patients, and visits lacking a record. Counts come from the list's total or the returned list, never from fetching everything. Every panel links to the screen that owns it, has its own loading, error, empty, and success states, and never makes an audited read ([ADR 0005](../../docs/decisions/0005-audit-safe-data-fetching.md)). Each dashboard respects the backend's permissions and handles unauthenticated, forbidden, and not-found answers.

## Context

Since Phase 3, signing in lands every role on a welcome that names them and their role, and nothing else. Each piece of the clinic's day now has its own screen: appointments (Phase 6), the queue (Phase 7), medical records (Phase 8), billing (Phase 9), reports (Phase 10). To answer "what needs me right now?", a person has to open several of them.

A dashboard answers that question on one page, for each role, using only what those screens already read. It is a summary and a set of ways in, not a new place to do work: every action stays on the screen that owns it. No new information is revealed to any role, as each panel uses a read that role already makes elsewhere.

The API has no summary endpoint (gap G3). So each figure comes from a list's total, from a report the role may read, or from a short list, never from reading every page of a list. None of the reads used here writes an audit entry; the reads that do (opening a patient, a medical record, a patient's history, or the audit trail) are never made by a dashboard.

## Clarifications

### Session 2026-11-11

- Q: How should dashboards get fresh data? → A: Split by kind. The receptionist's and the doctor's panels read every 15 seconds while visible, like the queue; the administrator's report figures read only when opened or when asked, like Reports.
- Q: Should the administrator's dashboard also show the receptionist's desk panels? → A: No. Oversight only: today's money, today's activity, and appointments needing a move.
- Q: Over what period should the doctor's record figures count? → A: The last 92 days, ending today, the longest period one request allows; the panel names the period.
- Q: Which of today's visits count as not yet charged? → A: Every visit today with no active charge, whatever its queue status, exactly as Billing's "not charged" filter, so the figure and the screen it links to agree.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The receptionist sees the desk's day at a glance (Priority: P1)

A receptionist signs in, or returns to the dashboard between patients, and sees today's appointments still to arrive, who has arrived, how the queue stands, which visits still owe money, and how many upcoming appointments must be moved. Each panel takes them to the screen where they act.

**Why this priority**: Reception works under the most time pressure and juggles the most screens. This is the role that gains the most, and its panels cover four modules.

**Independent Test**: With synthetic data for today (appointments in each status, queue entries in each status, visits uncharged, unpaid, partly paid, and paid, and one upcoming appointment outside availability), sign in as a receptionist and confirm each figure equals the matching screen's count for the same filter, that each panel's link opens that screen with that filter, and that no audit entry was written.

**Acceptance Scenarios**:

1. **Given** a receptionist opens the dashboard, **When** it appears, **Then** it shows panels for today's appointments, the queue, money owed on today's visits, and appointments needing a move, each with its own heading.
2. **Given** today's appointments, **When** the appointments panel is shown, **Then** it gives the number still to arrive, arrived, completed, and marked no-show, and lists the next few still to arrive with their time, patient, and doctor, in the API's order.
3. **Given** today's queue, **When** the queue panel is shown, **Then** it gives the number waiting, with a doctor, seen, and left, across all doctors.
4. **Given** today's visits, **When** the money panel is shown, **Then** it gives the number of visits not yet charged (whatever their queue status, including patients still waiting), unpaid, and partly paid, each labelled in words, and each equal to Billing's count for that filter.
5. **Given** upcoming appointments outside their doctor's current availability, **When** the move panel is shown, **Then** it gives their number and lists the soonest few with their date, time, patient, and doctor.
6. **Given** any panel, **When** the receptionist follows its link or one of its rows, **Then** the owning screen opens: Appointments for today, the Queue, Billing for today, the appointments needing a move, or that appointment's own page.
7. **Given** a panel with nothing to show, such as nobody waiting, **When** it is shown, **Then** it says so in words, and its figures show zero rather than a blank.

---

### User Story 2 - The doctor sees who is with them and who is next (Priority: P1)

A doctor signs in, or returns between patients, and sees the patient with them now, how many are waiting, who is next, and how many of their visits still lack a finished medical record.

**Why this priority**: The doctor's dashboard is what they see between every patient. It joins their queue and their records, which today are two separate screens.

**Independent Test**: With a synthetic doctor having one patient with them, three waiting, later appointments today, and past visits with no record and with an unfinished draft, sign in as that doctor and confirm each item matches My queue, My appointments, and My visits; that following each opens the right screen; and that no `encounter.opened`, `encounter.history_viewed`, or `patient.opened` entry was written.

**Acceptance Scenarios**:

1. **Given** a patient is with the doctor, **When** the dashboard is shown, **Then** it shows that patient's name, queue number, and when they were called, with a way to My queue; with nobody, it says nobody is with them.
2. **Given** patients waiting, **When** the dashboard is shown, **Then** it gives the number waiting and lists them in queue order with their queue number and name.
3. **Given** later appointments today that haven't arrived, **When** the dashboard is shown, **Then** it lists the next few with their time and patient, with a way to My appointments.
4. **Given** the doctor's visits over the period My visits allows, **When** the records panel is shown, **Then** it gives the number of visits with no record and the number with an unfinished draft, each leading to My visits filtered that way.
5. **Given** the dashboard, **When** it is shown, **Then** it never opens a medical record or a patient's history, and offers no action that changes the queue, such as calling the next patient; those stay on My queue.
6. **Given** a doctor-role account with no doctor profile, **When** they open the dashboard, **Then** they see the existing "profile not set up, contact an administrator" state, and no panel tries to read.

---

### User Story 3 - The administrator sees today's money and activity (Priority: P2)

An administrator opens the dashboard and sees what the clinic has taken today, how the day is going, and whether any upcoming appointments need moving after a schedule change.

**Why this priority**: Administrators already have the Reports screen for the same figures; the dashboard saves them choosing today's period, but nothing becomes possible that wasn't.

**Independent Test**: With synthetic payments and refunds by several methods today, appointments and visits in each status, and an upcoming appointment outside availability, sign in as an administrator and confirm every figure equals the Reports screen's for today, money exactly as sent, and that no audit entry was written.

**Acceptance Scenarios**:

1. **Given** today's payments and refunds, **When** the money panel is shown, **Then** it gives today's received, refunded, and net, and received by method, each exactly as the API sends it with its currency.
2. **Given** today's activity, **When** the activity panel is shown, **Then** it gives today's appointments by status, visits by status, booked and walk-in visits, new patients, and the no-show rate, or "Not available" when the API sends none, as Reports does.
3. **Given** upcoming appointments outside availability, **When** the move panel is shown, **Then** it gives their number and the soonest few, as for the receptionist.
4. **Given** each panel, **When** the administrator follows its link, **Then** the matching report opens for today, or the appointments needing a move.
5. **Given** a day with no money movement, **When** the money panel is shown, **Then** it shows zero totals and says no money was recorded today.

---

### User Story 4 - The dashboard stays honest when part of it fails (Priority: P2)

One of the reads behind a dashboard fails or is refused. The rest of the dashboard still works, and the failed panel says what happened.

**Why this priority**: A dashboard draws on several modules; without this, one slow or refused read blanks the whole home page.

**Independent Test**: With the fake backend, make one panel's read fail, then be refused, then return not found, and confirm only that panel shows its error, forbidden, or not-found state, the others show their figures, and trying again reads only that panel.

**Acceptance Scenarios**:

1. **Given** a panel whose read is slow, **When** the dashboard opens, **Then** that panel shows its own loading state and the others appear as they arrive.
2. **Given** a panel whose read fails, **When** it answers, **Then** that panel says it couldn't be loaded and offers trying again, and the other panels are unaffected.
3. **Given** a panel whose read is refused because the role changed, **When** it answers, **Then** that panel shows the forbidden state, clears any figures it showed, and stops reading.
4. **Given** a lapsed or deactivated session, **When** any panel reads, **Then** the app's sign-in flow takes over, and returns to the dashboard afterwards.
5. **Given** a panel that already shows figures, **When** a later read of it fails, **Then** it keeps the figures, marked with when they were read and that they are not up to date.

---

### Edge Cases

- **Totals, not everything.** A figure is a list's total for one filter, a report's total, or a count of a list the API returns whole (a doctor's own queue). A dashboard never reads further pages to count.
- **Lists are short.** Panels list at most five rows, in the API's order; the full list is on the owning screen. A panel says how many more there are when its total is larger. The one exception is the doctor's waiting list, which shows everyone waiting: the API returns the doctor's whole queue for today, and a doctor's list is short.
- **No sorting.** The API offers no sort (gap G4). Rows appear in the API's order, which is by time for appointments and by queue order for the queue.
- **Patient names.** Panels show names as returned by the list the role already reads. Names are never translated. Rows never link to a patient's record, as opening one writes `patient.opened`; they link to the appointment, the queue, or Billing instead.
- **Doctors see less.** A doctor's lists hold no phone, and the dashboard shows no more than they do.
- **Today.** "Today" is the clinic's date in its time zone, never the computer's. At midnight the next read uses the new date. A queue entry still open from yesterday isn't reachable (gap G8), so it doesn't appear.
- **Late appointments.** "Still to arrive" includes scheduled appointments whose time has already passed today, as the API still lists them as scheduled; they come first, in the API's order by time.
- **Appointments needing a move.** These are the upcoming ones the API flags, from today to 90 days ahead, the same period the Appointments screen's "needing a move" list shows, which is as far ahead as bookings can be made. The panel says the period it covers.
- **Money.** Amounts stay exactly as sent, including a negative net, with the currency; they are never added up by the frontend.
- **No-show rate.** Shown as the API sends it, to one decimal place, or as "Not available" when the API sends none.
- **Roles changing mid-session.** A panel refused on a later read shows the forbidden state; the dashboard does not change to another role's panels until the person reloads.
- **Unknown values.** A status with no translation, after a backend change, is shown as sent rather than hidden.
- **Language and direction.** Numbers, times, and money stay left-to-right inside Arabic text; the layout follows the reading direction.
- **Shared desk computers.** A visible dashboard that reads by itself keeps a session alive, as the queue already does; decision Q2 accepts this.

### Out of Scope

Any action on a dashboard (booking, check-in, calling the next patient, charging); choosing a date other than today; choosing which panels appear or rearranging them; charts; per-doctor breakdowns on the receptionist's dashboard; figures the API can't give as a total, such as seen visits not yet charged; notifications or sounds; a waiting-room display; and any backend change, including a summary endpoint (gap G3).

## Requirements *(mandatory)*

### Functional Requirements

**Access**

- **FR-001**: `/dashboard` MUST show the signed-in person's role's dashboard, chosen through the one permissions map: the administrator's, the receptionist's, or the doctor's. The welcome heading naming the person and their role stays at the top.
- **FR-002**: Each panel MUST use only reads its role is permitted by the backend and already makes on another screen. Hiding a panel is not security: each MUST handle the API's unauthenticated, forbidden, and not-found answers itself.
- **FR-003**: A doctor without a doctor profile MUST see the existing profile-not-set-up state instead of the doctor's panels.

**What is read**

- **FR-004**: No dashboard MUST make a read the backend audits: opening a patient, a medical record, a patient's history, or the audit trail. No dashboard link MUST be prefetched to one of those.
- **FR-005**: Each figure MUST come from a list's total, a report's total, or a list the API returns whole. A dashboard MUST NOT read more than one page of any list.
- **FR-006**: Panels MUST read independently, so that one panel's loading, failure, or refusal doesn't affect another's.
- **FR-007**: The receptionist's and the doctor's panels MUST read themselves every 15 seconds while the page is visible, as the queue does (decision Q4), and never while it is hidden. The administrator's panels MUST read only when the dashboard opens and when the person asks, as Reports do (ADR 0016). Every dashboard MUST say when each panel was last read, and offer reading again.
- **FR-008**: A dashboard MUST hold no action that changes data. Every action stays on the screen that owns it.

**Receptionist**

- **FR-009**: The receptionist's dashboard MUST show: today's appointments still to arrive, arrived, completed, and no-show, with the next five still to arrive; today's queue waiting, with a doctor, seen, and left; today's visits not charged (every visit today with no active charge, whatever its queue status), unpaid, and partly paid; and upcoming appointments outside availability, with the soonest five.

**Doctor**

- **FR-010**: The doctor's dashboard MUST show: the patient with them now, or that there is none; the number waiting and who, in queue order; the next five of today's appointments not yet arrived; and the number of their visits with no record and with an unfinished draft over the last 92 days ending today, the longest period one request allows, naming that period on the panel.

**Administrator**

- **FR-011**: The administrator's dashboard MUST show only the following, and not the receptionist's desk panels: today's money received, refunded, and net, and received by method; today's activity (appointments by status, visits by status, booked and walk-in visits, new patients, no-show rate); and upcoming appointments outside availability, with the soonest five.

**Links**

- **FR-012**: Each panel MUST link to the screen that owns its figures, with the matching filter where that screen accepts one, and each listed appointment MUST link to its own page. No row MUST link to a patient's record or a medical record.

**Display**

- **FR-013**: Money MUST stay a string from the API to the screen, shown exactly as sent with its currency. Clinic dates and times MUST be shown as sent; instants in the clinic's time zone.
- **FR-014**: Statuses, methods, and roles MUST be shown translated, and any value without a translation as sent. Names MUST be shown as stored. A figure MUST never be conveyed by color alone.

**States**

- **FR-015**: Each panel MUST have its own loading, error, empty, and success states, and the forbidden and not-found states. A failed read MUST offer trying again by the person's action, and a failed later read MUST keep the last figures, marked as not up to date.
- **FR-016**: All user-facing text MUST exist in English and Arabic, and each dashboard MUST work in both directions and both themes, at desk and narrow widths.

### Key Entities *(include if feature involves data)*

- **Dashboard**: One per role, made of panels; holds no data of its own.
- **Panel**: A heading, one or more figures, an optional short list, a link to its owning screen, and the time it was last read.
- **Figure**: A labelled count or amount, from a list's total or a report's total, with the filter it counts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A receptionist can tell how many patients are waiting, how many appointments are still to arrive, and how many visits owe money within 5 seconds of opening the dashboard, without opening another screen.
- **SC-002**: In automated tests against the running API, every dashboard figure equals the count or total of its owning screen for the same filter, for each role, including money exactly as sent.
- **SC-003**: In automated tests against the running API, opening, reading again, and leaving each role's dashboard open write no audit entry of any kind.
- **SC-004**: In automated tests, one panel's failure, refusal, or not-found answer leaves every other panel's figures shown.
- **SC-005**: Each dashboard has loading, error, empty, and success states, in both languages, both directions, and both themes, with no hard-coded user-facing text and no accessibility violations in automated checks.
- **SC-006**: Each role sees only its own dashboard's panels, and no panel shows information its role can't already see on another screen.

## Assumptions

- The backend endpoints used are final and unchanged since commit `dff2dca`; their contracts are the source of every filter used here. All of them are already used and verified by Phases 6–10.
- Counts for one status come from a list read for that status with one row, using its total. Several statuses mean several small reads; the API offers no grouped count (gap G3).
- "Still to arrive" is a scheduled appointment today; "arrived" is checked in. Completed and no-show are shown separately. Cancelled appointments are not shown on the receptionist's dashboard, as nothing remains to do for them; the administrator's activity panel includes them.
- "Owes money" covers today's visits not yet charged, unpaid, and partly paid, shown as three figures, as Billing's filter offers them. "Not yet charged" includes patients still waiting or with a doctor (clarified 2026-11-11).
- The doctor's "next patients" are those waiting in their queue, in queue order, and separately today's scheduled appointments not yet arrived.
- The doctor's record figures cover the longest period My visits accepts (92 days), ending today (clarified 2026-11-11); older visits are left out, and the panel says the period.
- Appointments needing a move cover today to 90 days ahead, as the Appointments screen's own "needing a move" list does, so the figure equals what its link shows; bookings can't be made further ahead.
- The administrator's figures are today's, from the same reports Phase 10 shows; they do not include the receptionist's desk panels (clarified 2026-11-11), which administrators can reach from their navigation. Activity's visit counts already give the queue's state.
- Five rows per list is a fixed size, chosen to fit a desk screen beside the other panels.
- Times, and when a panel was last read (shown as a clock time), follow the existing queue and Billing screens.
