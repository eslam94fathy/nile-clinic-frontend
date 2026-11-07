# Feature Specification: Queue

**Feature Branch**: `007-queue`

**Created**: 2026-11-07

**Status**: Draft

**Input**: User description: "Start Phase 7" of `docs/roadmap.md`: the queue. Check-in on an appointment's page, reception's live list with walk-ins, left, and undo check-in, and the doctor's call-next and finish flow, refreshing every 15 seconds while the tab is visible (roadmap decision Q4).

## Clarifications

### Session 2026-11-07

- Q: What should the Queue page show when reception opens it: everyone from today, or only people who are still waiting? → A: All of today's entries for all doctors, every status, grouped by doctor, with filters for one doctor or one status.
- Q: Should the patient's page gain a third link, "Add to today's queue", which carries that patient into the walk-in form? → A: Yes. It opens the walk-in form with that patient already chosen, and the page itself shows no queue information.
- Q: Should doctors confirm in a dialog each time they use "Call next" and "Finish visit"? → A: Yes, both ask for confirmation, because a mistaken click creates a false record that can't be corrected.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Check in an arriving patient (Priority: P1)

A patient with an appointment today arrives at the desk. Reception finds the appointment, opens it, and checks the patient in. The patient gets a number on that doctor's list for today and is now waiting.

**Why this priority**: Every other part of this phase starts from someone having arrived. Without check-in, no list exists.

**Independent Test**: Book a synthetic appointment for today, check the patient in from its page, then confirm the page shows it as checked in, the confirmation gives the queue number, the patient is on the Queue page, and the audit trail gained `visit.checked_in` and no `patient.opened`.

**Acceptance Scenarios**:

1. **Given** a scheduled appointment dated the clinic's today, **When** its page is shown, **Then** "Check in" is offered, whether the start has passed or not, alongside the actions Phase 6 already offers at that time.
2. **Given** a scheduled appointment on another date, **When** its page is shown, **Then** "Check in" isn't offered.
3. **Given** the person chooses "Check in", **When** the API accepts, **Then** a confirmation gives the queue number, the page shows the appointment as checked in, and it offers a link to that doctor's list.
4. **Given** an appointment that has become impossible to check in, for example because someone else already did or it was cancelled, **When** "Check in" is chosen, **Then** the API's message appears, and the page shows the appointment's current state.
5. **Given** two people check in one appointment at the same moment, **When** both finish, **Then** one succeeds, the other sees the API's message, and the patient is on the list once.
6. **Given** a checked-in or completed appointment, **When** its page is shown, **Then** it offers no change to the appointment. A checked-in appointment links to that doctor's list.
7. **Given** a checked-in appointment whose check-in was undone, **When** its page is shown again, **Then** it is scheduled, and offers what a scheduled appointment offers.

---

### User Story 2 - See today's queue at the desk (Priority: P1)

Reception opens the Queue page and sees who is waiting, who is with a doctor, who has been seen, and who left today, by doctor and in queue order. They can narrow it to one doctor or one status, so they can answer a patient's "how long until my turn?" by showing their place in the order.

**Why this priority**: A queue is only useful if staff can see it. With User Story 1 this is the smallest usable slice of the phase.

**Independent Test**: Check in synthetic patients with two doctors. Confirm the page shows both, grouped by doctor and in the API's order. Filter by doctor and by status, reload, and go back, confirming the same results each time.

**Acceptance Scenarios**:

1. **Given** the page is opened with no filters, **When** it appears, **Then** it lists today's entries for all doctors and every status, in the API's order, grouped under each doctor's name.
2. **Given** a row, **When** it is shown, **Then** it gives the queue number, status, arrival time, the appointment's start and end or a "walk-in" label, the times called, finished, or left where they exist, and the patient's number, name, and phone.
3. **Given** a doctor or a status is chosen, **When** results appear, **Then** they match, and the filters and page number survive a reload and the back button.
4. **Given** a doctor and a status are chosen together, **When** results appear, **Then** the list shows that doctor's entries with that status, in the API's order.
5. **Given** nobody has arrived today, or nobody matches the filters, **When** the list finishes, **Then** an empty state says so in neutral words, keeps the filters, and offers today's appointments and adding a walk-in.
6. **Given** a row that came from an appointment, **When** a person follows its link, **Then** that appointment's page opens.
7. **Given** a patient's name in a row, **When** a person follows it, **Then** the patient's record opens and writes one true opening. Showing, hovering over, or refreshing the row writes nothing.
8. **Given** an address naming a doctor who doesn't exist, or a value that isn't valid, **When** it is opened, **Then** a neutral not-found state or the unfiltered list appears, and nothing breaks.

---

### User Story 3 - A list that stays current (Priority: P1)

Reception and doctors work on different computers, and the API has no way to push changes. So each list reads itself again every 15 seconds while it's on screen, and stops when it isn't. What the person is doing isn't disturbed by this.

**Why this priority**: A stale queue causes real harm at a clinic: a patient told the wrong thing, or a doctor thinking nobody is waiting. Roadmap decision Q4 sets the 15 seconds, and decision Q2 requires that it stops on hidden tabs.

**Independent Test**: Keep the Queue page open on one computer and make changes on another, confirming they appear within the interval. Hide the tab, navigate to another page, and leave a page held by the browser, confirming no reads are made in each case. Make reads fail, confirming the last list stays on screen with a clear notice.

**Acceptance Scenarios**:

1. **Given** a list is visible, **When** 15 seconds pass, **Then** it is read again, and any change appears without a reload and without a loading state replacing the list.
2. **Given** the tab is hidden or the person is on another page of the application, **When** time passes, **Then** no read is made.
3. **Given** a list becomes visible again, **When** it returns, **Then** it is read at once, and reading continues every 15 seconds.
4. **Given** a list is on screen, **When** it was last read, **Then** the page says when, in the clinic's time zone, and offers a way to refresh now.
5. **Given** a refresh fails, **When** the failure is a connection or server error, **Then** the last list stays on screen, a notice says it may be out of date and when it was last read, and reading continues on schedule.
6. **Given** the first read of a list fails, **When** there's nothing yet to show, **Then** the error state appears with a way to try again.
7. **Given** a person is using a control, menu, or confirmation, **When** a refresh brings changes, **Then** their focus and what they were doing are kept. If their row is gone, focus moves to a sensible place on the page and never disappears.
8. **Given** a refresh brings changes, **When** it finishes, **Then** assistive technology isn't made to announce the list on every refresh.
9. **Given** the list on a later page shrinks, **When** that page no longer exists, **Then** the person sees the last page that does, not a false empty state.

---

### User Story 4 - A doctor calls the next patient and finishes the visit (Priority: P1)

A doctor opens "My queue" and sees their list for today. They call the next patient, see who it is, and when the visit ends they finish it so the next can be called. They see only what the API allows them: the patient's number, name, sex, and date of birth.

**Why this priority**: This is how the list moves, and it's the doctor's main screen until Phase 8 adds records to it.

**Independent Test**: As a synthetic doctor with two waiting patients, call next and confirm who is shown as current. Finish, then call next again, confirming the second patient is current, the first is seen, and the appointment became completed. Confirm no contact detail appears, and the audit trail gained `visit.called` and `visit.finished` and no `patient.opened`.

**Acceptance Scenarios**:

1. **Given** a doctor with a profile, **When** they open "My queue", **Then** their list for today appears in the API's order, each row with the queue number, status, arrival time, the appointment's start and end or a "walk-in" label, the times called and finished where they exist, and the patient's number, name, sex, and date of birth.
2. **Given** a patient is with the doctor, **When** the page is shown, **Then** that patient is shown as current, set apart from the list, and "Finish visit" is offered instead of "Call next".
3. **Given** nobody is with the doctor and the list shows someone waiting, **When** the page is shown, **Then** "Call next" is offered.
4. **Given** the doctor chooses "Call next", **When** the confirmation appears, **Then** it says the next patient in the queue will be called, and that a called patient can't be sent back. It doesn't name a patient, because the API decides who is next.
5. **Given** the doctor confirms, **When** the API accepts, **Then** the patient the API returned is shown as current, with a confirmation naming them.
6. **Given** the doctor chooses "Finish visit", **When** the confirmation appears, **Then** it names the current patient, and says this can't be undone.
7. **Given** the doctor confirms finishing, **When** the API accepts, **Then** the patient is shown as seen, and "Call next" is offered again if someone is waiting.
8. **Given** the API refuses calling or finishing, for example because the list on screen was out of date or everyone waiting is with another doctor, **When** the answer arrives, **Then** its message appears, and the list is read again at once.
9. **Given** nobody has arrived, or nobody is left waiting, **When** the page is shown, **Then** a state says so in neutral words, and the list keeps refreshing, so a new arrival appears by itself.
10. **Given** a row, **When** it is shown, **Then** it offers no link to a patient record, and no reception action.
11. **Given** a doctor account with no profile yet, **When** it opens "My queue", **Then** the "profile not set up, contact an administrator" state appears, and no further reads are made.

---

### User Story 5 - Add a walk-in (Priority: P2)

A registered patient arrives with no appointment and asks to see a doctor today. Reception finds the patient, chooses a doctor, and adds them to that doctor's list. No time is taken from the doctor's bookable slots.

**Why this priority**: Walk-ins are common, but a clinic can start with booked patients alone.

**Independent Test**: Add a synthetic patient as a walk-in, confirming the row's number and "walk-in" label, that the doctor's free times are unchanged, and that the audit trail gained `visit.walk_in_added` and no `patient.opened`. Add the same patient again, confirming the API's refusal appears on the patient field.

**Acceptance Scenarios**:

1. **Given** the Queue page, **When** a person chooses to add a walk-in, **Then** they can search for a patient by name, phone, patient number, or national ID, following Phase 5's rules, and choosing one doesn't open their record or write an opening.
2. **Given** the search finds nobody, **When** it finishes, **Then** an empty state offers to register a new patient.
3. **Given** a patient is chosen, **When** the person chooses a doctor, **Then** only active doctors are offered, findable by name or specialty.
4. **Given** the form is submitted, **When** the API accepts, **Then** a confirmation gives the queue number, the Queue page appears with the list read again at once, and the form is empty when next opened.
5. **Given** the patient is already waiting or with that doctor today, or the patient or doctor is refused, **When** the answer arrives, **Then** the API's message appears on the matching field, or at form level if none matches, and what was chosen is kept.
6. **Given** the form is under way, **When** the person leaves it for the Queue page, **Then** nothing is added.
7. **Given** a patient's page, including one shown just after registering, **When** a person follows "Add to today's queue", **Then** the walk-in form opens with that patient already chosen and shown from list fields only, no opening is written, and only the patient number appears in the address.

---

### User Story 6 - Correct the list (Priority: P2)

A waiting patient gets tired and goes home, or reception checked in the wrong appointment. Reception marks the patient as left, or undoes the check-in.

**Why this priority**: Corrections keep the list honest, and without "left" a doctor could call someone who's gone. They're rarer than the main flow.

**Independent Test**: Check in two synthetic patients. Mark one as left, confirming the row stays with its time and the audit trail gained `visit.left`. Undo the other, confirming the row is gone, the appointment is scheduled again, and the audit trail gained `visit.check_in_undone`. Check it in again and confirm a new number.

**Acceptance Scenarios**:

1. **Given** a waiting row, **When** it is shown, **Then** "Mark as left" is offered. Rows with any other status offer no action.
2. **Given** a waiting row that came from an appointment, **When** it is shown, **Then** "Undo check-in" is also offered. A walk-in's row doesn't offer it.
3. **Given** the person chooses "Mark as left", **When** the confirmation appears, **Then** it names the patient and says this can't be undone.
4. **Given** the person chooses "Undo check-in", **When** the confirmation appears, **Then** it names the patient, says their appointment returns to scheduled, and that their queue number isn't reused.
5. **Given** the person confirms, **When** the API accepts, **Then** a confirmation appears, and the list is read again at once.
6. **Given** the entry has changed in the meantime, for example the doctor just called the patient, or undoing is refused because the visit has an active charge, **When** the API refuses, **Then** its message appears, and the list is read again at once.
7. **Given** the person dismisses a confirmation, **When** it closes, **Then** nothing changes, and focus returns to the control that opened it, or to a sensible place if that row has gone.

---

### User Story 7 - Roles and refusals (Priority: P1)

Administrators and receptionists have the same queue access. Doctors have only their own list. A role changed during a session is handled by whatever the API answers, including during a background refresh.

**Why this priority**: These screens hold patient names and phones and refresh by themselves, so a refusal mustn't leave details on screen.

**Independent Test**: Sign in as each role and compare every queue page and action against the verified permission matrix. Then force a refusal during a refresh, and end the session during a refresh, confirming what appears.

**Acceptance Scenarios**:

1. **Given** a doctor, **When** they open the Queue page's address, **Then** the "not allowed" state appears, and no queue is read.
2. **Given** an administrator or receptionist, **When** they open "My queue"'s address, **Then** the "not allowed" state appears, and no queue is read.
3. **Given** a role changed mid-session, **When** the API answers `403` to a refresh or an action, **Then** the "not allowed" state or message appears, whatever the screen believed, any patient details on screen are removed, and refreshing stops.
4. **Given** the session has ended, **When** the API answers `401` to a refresh or an action, **Then** the usual sign-in redirect applies, refreshing stops, and the return address carries no patient number.
5. **Given** a person signs out, **When** anyone uses that computer next, **Then** no queue, patient details, or search terms remain, whether on screen, in hidden pages, in memory, or in browser storage.

---

### Edge Cases

- **Midnight.** "Today" is the API's, on the clinic's clock. After midnight the next read shows the new day's list, which is normally empty. Nothing changes automatically, so anyone still waiting or with a doctor stays that way on a day the API offers no way to reach (see Assumptions). The screen doesn't invent an explanation, and shows only what the API returns.
- **A visit still open at midnight.** "Finish visit" acts on today, so once the list has moved to the new day, the old visit can't be finished through the application.
- **Call next skipping someone.** The API skips a waiting patient who is with another doctor, so the patient called may not be the first waiting row. The application shows who the API returned, and doesn't try to predict it.
- **Everyone waiting is with another doctor.** The list shows people waiting and "Call next" is offered, and the API's refusal says nobody can be called.
- **One patient on two doctors' lists.** This is allowed, and each list shows its own entry.
- **A late patient goes ahead of those booked later.** Order is by appointment time, with walk-ins placed by arrival time, so a new arrival can appear above existing rows. The application uses the API's order, and doesn't calculate one. Queue numbers can therefore appear out of sequence, and the numbers aren't a position.
- **Numbers after an undo.** A number that was undone isn't reused, so gaps are normal. The page mustn't suggest otherwise.
- **An inactive doctor.** Their appointment can still be checked in. They aren't offered for walk-ins, and their list can still be viewed.
- **An appointment flagged as outside availability.** It can still be checked in, as the patient is physically here.
- **Check-in and no-show together.** After an appointment's start has passed, today, both are offered. The person decides, and the API's answer wins.
- **The connection fails during an action, so the outcome is unknown.** The screen says it can't tell whether the action was saved, and reads the list or appointment again, so the screen shows what's true. Actions are never repeated automatically.
- **Adding a walk-in twice after a lost connection.** The API refuses a patient already waiting or with that doctor.
- **Adding a patient who has already been seen or left today.** The API allows this, and they get a new entry.
- **An audit entry can't be saved.** The API answers `500` and the action did not happen. A general error appears, and the application doesn't claim otherwise.
- **Very long lists.** The clinic-wide list is paged by the API, so a doctor's rows can continue on the next page. Each page repeats the doctor's name above their rows, and no count of a doctor's patients is claimed from a partial page.
- **A computer in another time zone.** Moments are shown in the clinic's time zone, and appointment times as sent, including an end of `24:00`.
- **A computer asleep, then woken.** The list is read when it's visible again. Until that finishes, the last-read time shows how old it is.
- **Long names.** They wrap without breaking the row, in their own direction.

## Requirements *(mandatory)*

### Functional Requirements

**Check-in**

- **FR-001**: Administrators and receptionists MUST be able to check in the patient of a scheduled appointment dated the clinic's today, from that appointment's page, at any time that day. This replaces Phase 6's FR-023.
- **FR-002**: Check-in MUST be offered only on a scheduled appointment dated the clinic's today. This only decides what's offered: the API's answer MUST win. Phase 6's rules for reschedule, cancel, and no-show stay as they are.
- **FR-003**: After check-in, the application MUST confirm with the queue number the API returned, show the appointment's new state, and link to that doctor's list.
- **FR-004**: A checked-in appointment's page MUST link to that doctor's list. Undoing a check-in MUST happen from the queue, not from the appointment's page.
- **FR-005**: Check-in MUST NOT ask for confirmation, because a mistake can be corrected by undoing it, and the desk does it many times a day.

**Reception's list**

- **FR-006**: The Queue page MUST open on today's entries for all doctors and every status, in the API's order, grouped by doctor, and MUST offer filters for one doctor and one status.
- **FR-007**: Filters and page number MUST live in the page's address, so they survive a reload and the back button.
- **FR-008**: The doctor filter MUST include inactive doctors, whose patients may still be on a list.
- **FR-009**: Rows MUST show the queue number, status, arrival time, appointment times or a "walk-in" label, the times called, finished, or left where they exist, the doctor, and the patient's number, name, and phone. They MUST NOT show anything the API doesn't send, such as a note.
- **FR-010**: A row from an appointment MUST link to that appointment. A patient's name MUST link to their record through the link that records a person's click, and MUST NOT read the record ahead of that click.
- **FR-011**: The application MUST NOT calculate order, position, or waiting time, or offer a sort. A queue number MUST NOT be presented as a position.
- **FR-012**: The Queue page MUST offer a way to reach today's appointments, where check-in happens.

**Keeping lists current**

- **FR-013**: Reception's list and "My queue" MUST read themselves every 15 seconds while visible, and MUST make no reads while the tab is hidden or while the person is on another page, including a page held hidden by the application.
- **FR-014**: A list MUST be read at once when it becomes visible again, and after any action on it, whatever the outcome.
- **FR-015**: A refresh MUST NOT replace the list with a loading state, move the person's focus, close a confirmation, or clear what they typed.
- **FR-016**: A page MUST show when its list was last read, in the clinic's time zone, and offer a way to refresh now.
- **FR-017**: When a refresh fails with a connection or server error, the last list MUST stay on screen with a notice that it may be out of date, and reads MUST continue on schedule. When a first read fails, the error state MUST appear with a way to try again.
- **FR-018**: A `401`, `403`, or a `404` for a doctor with no profile MUST stop refreshing, and MUST remove any patient details from the screen.
- **FR-019**: Refreshing MUST NOT be announced to assistive technology, while the result of a person's own action MUST be.
- **FR-020**: No read on these pages MUST cause an audit entry. These pages MUST NOT read a patient's record, which would write an opening.

**Doctor's list**

- **FR-021**: Doctors MUST be able to see their own list for today, with the patient's number, name, sex, and date of birth, and MUST NOT see a phone or any other contact detail.
- **FR-022**: The patient with the doctor MUST be set apart from the list as current. "Finish visit" MUST be offered while the list shows one, and "Call next" MUST be offered while it shows none and at least one waiting.
- **FR-023**: "Call next" and "Finish visit" MUST ask for confirmation, as neither can be undone. "Call next" MUST NOT name a patient before the API answers, and after it answers, the application MUST show the patient the API returned.
- **FR-024**: The doctor's page MUST offer no link to a patient record and no medical record. Those belong to Phase 8. It MUST NOT suggest that finishing a visit requires or creates a record.
- **FR-025**: A doctor with no profile MUST see the existing "profile not set up" state.

**Walk-ins**

- **FR-026**: Administrators and receptionists MUST be able to add a registered patient to an active doctor's list for today, using the same patient search and doctor choice as booking, with search terms kept out of addresses, titles, logs, and browser storage.
- **FR-027**: Choosing a patient MUST NOT open their record or write an opening. Registering a patient MUST be reachable when the search finds nobody.
- **FR-028**: After a walk-in is added, the application MUST confirm with the queue number the API returned, and the form MUST be empty when next opened.
- **FR-029**: A walk-in form MUST say that a walk-in can't be removed, only marked as left, before it's submitted.
- **FR-029a**: The patient's page MUST gain an "Add to today's queue" link, including when a record is shown after registering, which opens the walk-in form with that patient already chosen. The page MUST NOT show any queue information itself. The link MUST NOT cause any further read of the record, and following it MUST write no opening. This adds to Phase 6's FR-024, whose other limits stay.

**Corrections**

- **FR-030**: "Mark as left" MUST be offered on waiting rows only, and "Undo check-in" on waiting rows from an appointment only. This only decides what's offered: the API's answer MUST win.
- **FR-031**: Both MUST ask for confirmation, name the patient, and say what can't be undone: a person marked as left stays so, and an undone check-in's number isn't reused.

**Access**

- **FR-032**: This phase's real pages MUST replace the "not available yet" placeholders for Queue and My queue. Later phases' placeholders MUST stay as they are.
- **FR-033**: Page access and controls MUST follow the single role map. The API's `401`, `403`, and `404` MUST be handled on every screen, action, and refresh, whatever the map says.
- **FR-034**: A person's return after sign-in MUST NOT open a patient's record and MUST NOT carry a patient number.
- **FR-035**: Signing out, or a `401`, MUST leave no queue, patient details, or search terms in hidden pages, memory, or browser storage.

**Cross-cutting**

- **FR-036**: Every view MUST provide loading, error, empty, and success states, using the shared design system, with all text in both languages and working in both directions.
- **FR-037**: Every action MUST show progress, prevent double submission, show the API's message on the matching field or otherwise at form level, and confirm success. The application MUST branch only on status, the error's field key, and a conflict's `reason`, never on message text. Actions MUST NOT be repeated automatically.
- **FR-038**: Statuses MUST be translated by the application and shown with the shared status mapping, as text and never color alone. Names MUST appear as written, in their own direction.
- **FR-039**: Appointment times and dates of birth MUST be shown as sent. Arrived, called, finished, left, and last-read moments MUST be shown in the clinic's time zone.
- **FR-040**: Patient details and search terms MUST NOT be written to logs, analytics, or error reports, and tests MUST use synthetic data only.
- **FR-041**: Patient search fields MUST ask the browser not to remember or suggest what was typed, and digits typed in Arabic form MUST be converted to Western digits in number and phone search fields before sending. Names MUST NOT be altered.

### Key Entities

- **Queue entry (a "visit")**: One patient on one doctor's list for one clinic day. It has a number, a status, whether it's a walk-in, the moments it arrived, was called, finished, or left, and the appointment it came from, if any. Never edited directly, and removed only by undoing a check-in.
- **Queue status**: `waiting`, `with_doctor`, `seen`, or `left`. Only `waiting` can be changed by reception, and only the current patient can be finished by the doctor.
- **Queue number**: A label given on arrival, per doctor and day, never reused. It isn't a position in the order.
- **Appointment**: From Phase 6. Check-in makes it `checked_in`, finishing makes it `completed`, and undoing makes it `scheduled` again. It holds no link to its queue entry.
- **Conflict reason**: The API's only machine-readable refusal. Here, a check-in that lost a race, or a patient already with another doctor.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A receptionist can find an arriving patient's appointment for today and check them in in under 30 seconds, using only the application.
- **SC-002**: A change made on one computer appears on another showing the same list within 20 seconds, in 100% of test runs, without anyone touching the second computer.
- **SC-003**: With a list hidden or left for another page for 2 minutes, zero reads of it are made, and a read is made within 1 second of it being shown again.
- **SC-004**: Across a scripted journey with several minutes of refreshing, covering check-in, walk-in, marking as left, undoing, calling, and finishing, the patient opening entries added are exactly those a person asked for by following a link to a record, and each action adds exactly one matching entry.
- **SC-005**: A doctor can call the next patient and see who was called in under 5 seconds, and in 100% of test runs that's the patient the API returned.
- **SC-006**: During repeated refreshes, a person can finish a confirmation and use the filters without losing focus or anything chosen, in 100% of test runs, including when the row they're confirming changes or disappears.
- **SC-007**: When reads fail, the last list stays visible with its notice, and when they recover the notice clears by itself, in 100% of test runs.
- **SC-008**: A search of the address history, browser storage, and application logs after a full journey finds no synthetic search term or patient detail, other than patient and doctor numbers in addresses.
- **SC-009**: For each role, 100% of queue pages and controls agree with the verified permission matrix, by automated comparison, and a refusal forced during a refresh leaves no patient details on screen.
- **SC-010**: Every refusal the API can give on these actions appears on the correct field or at form level, with zero dropped, in both languages.
- **SC-011**: Every screen shows correct loading, error, empty, and success states, in both languages and directions.
- **SC-012**: Automated accessibility checks report no WCAG 2.2 AA violations on the new screens in either language or direction, and check-in, adding a walk-in, marking as left, undoing, calling, and finishing can each be done by keyboard alone.
- **SC-013**: Every queue operation is exercised against the running API, with its fields and statuses confirmed to match the contract.
- **SC-014**: Every quality check passes, and results recorded for this phase are ones actually observed.

## Assumptions

- The 15-second interval and pausing on hidden tabs come from roadmap decisions Q4 and Q2, including the accepted risk that a visible queue screen keeps a session alive indefinitely (hazard H3).
- Reading a queue isn't audited, verified in the backend's source (`QueueService`, `DoctorQueueService`), so refreshing is safe. This phase confirms it on the running API. Each action writes one audit entry: `visit.checked_in`, `visit.walk_in_added`, `visit.left`, `visit.check_in_undone`, `visit.called`, or `visit.finished`.
- Check-in stays on the appointment's page, as the roadmap says, and as Phase 6 put actions on an appointment's page. Reception finds it through the Appointments page, which opens on today.
- Undoing happens from the queue because the API's appointment responses hold no link to the queue entry.
- Administrators see the same queue screens as receptionists, as the API draws no distinction between them.
- Confirmation on "Call next" and "Finish visit" follows the constitution's rule for irreversible actions: the API has no way to send a called patient back or reopen a finished visit, and the only way to clear a patient called by mistake is to finish the visit, which marks their appointment completed.
- The API offers a status filter only on the clinic-wide list. A doctor's list is complete, not paged, so narrowing it by status on screen can't mislead.
- `/queue/walk-ins` lists a `409` in its contract that the backend's own verification found unreachable. It's handled like any other conflict, and isn't tested on the running API.
- Past days' lists aren't reachable through the API, which has no date parameter. An entry still waiting or with a doctor at midnight stays so, and its appointment stays `checked_in`, with no way to change it. This is to be recorded as a backend gap in `docs/backend-integration.md`, and clinics are expected to mark people as left before closing.
- The active-charge refusal on undoing can't occur until Phase 9 adds charging. It's covered through the fake backend until then.
- Live end-to-end tests run against the Docker backend with synthetic data. The audit trail is read through the API by a test administrator, because the audit screen arrives in Phase 11.

### Out of scope

Waiting-time estimates; a waiting-room display; patient notifications or self check-in; moving a waiting patient to another doctor, or reordering a list; past days' lists; medical records, the current visit's record status, and the patient's history, which arrive in Phase 8; charging from the queue, which arrives in Phase 9; dashboards, which arrive in Phase 12; a real-time channel, which the API doesn't have; check-in from a list row; printing; and any backend change.
