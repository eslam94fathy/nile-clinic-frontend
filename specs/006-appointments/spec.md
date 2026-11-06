# Feature Specification: Appointments

**Feature Branch**: `006-appointments`

**Created**: 2026-11-07

**Status**: Draft

**Input**: User description: "Start Phase 6" of `docs/roadmap.md`: appointments. Booking with slots, conflicts, reschedule, cancel, no-show, outside-availability, for administrators and receptionists, plus a doctor's own read-only appointments.

## Clarifications

### Session 2026-11-07

- Q: What should the Appointments page show when opened, given that its rows show a patient's name and phone on shared reception screens? → A: Today's appointments for all doctors, with filters for other dates, doctors, patients, and statuses. This differs from patient search, which shows nothing until someone searches, because today's list is the desk's daily work, and it holds only the people expected today.
- Q: How should free times be shown when booking or rescheduling? → A: Seven days from a chosen date, which defaults to today, grouped by day, with next and previous week.
- Q: Should the patient's page connect to appointments, which Phase 5 kept off it? → A: Yes, with two links only: "Book appointment" and "View appointments", each carrying the patient forward. No appointment information appears on the patient's page itself.
- Q: Should the default appointment lists include cancelled and no-show appointments, given that the API's status filter takes one status and can't exclude any? → A: Yes. Unless a status is chosen, the lists show every status, each with its label.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Book a patient into a free time (Priority: P1)

A patient calls or stands at the desk asking to see a doctor. Reception finds the patient, chooses a doctor, looks through that doctor's free times with the patient, and books one, adding a short note if needed. That time is then no longer offered to anyone else.

**Why this priority**: Booking is the reason this phase exists. Check-in, the queue, the visit, and billing all begin from a booked appointment.

**Independent Test**: Give a synthetic doctor weekly hours and a synthetic patient. Book the patient into a free time, then confirm the appointment's details, that the time is no longer offered, and that the audit trail gained `appointment.booked` and no `patient.opened`.

**Acceptance Scenarios**:

1. **Given** a person opens the booking page with no patient chosen, **When** they search by name, phone, patient number, or national ID, **Then** matching patients appear with list fields only, and choosing one doesn't open their record or write an opening.
2. **Given** a person arrives from a patient's page, **When** the booking page appears, **Then** that patient is already chosen and shown, with no opening written.
3. **Given** a search finds nobody, **When** it finishes, **Then** an empty state offers to register a new patient.
4. **Given** a patient is chosen, **When** the person chooses a doctor, **Then** only active doctors are offered, they can be found by name or specialty, and that doctor's free times for seven days from today appear, grouped by day.
5. **Given** free times are shown, **When** the person moves to the next or previous week or chooses a date, **Then** the free times for those seven days appear, never before the clinic's today or beyond 90 days ahead.
6. **Given** the doctor has no free times in those seven days, **When** they are shown, **Then** an empty state says so in neutral words and offers the next week, without claiming why.
7. **Given** a patient, doctor, and free time are chosen, **When** the form is submitted, **Then** the appointment is booked, a confirmation appears, and the appointment's page shows it.
8. **Given** the note holds up to 500 characters, **When** the person fills it in, **Then** a visible hint says not to enter medical details. An empty note is no note.
9. **Given** someone else took the time first, **When** the form is submitted, **Then** the API's message appears, the free times are read again, the time is no longer selected, and the patient, doctor, and note are kept.
10. **Given** the patient already has an appointment overlapping the chosen time, **When** the form is submitted, **Then** the API's message appears, the free times are read again, what was typed is kept, and a link leads to that patient's appointments on that date.
11. **Given** the API refuses the time as not available, or refuses the patient, doctor, or note, **When** the answer arrives, **Then** its message appears on the matching field, or at form level if none matches, and nothing is dropped.
12. **Given** a booking succeeded, **When** the person later returns to the booking page, **Then** it is empty.

---

### User Story 2 - See and find appointments (Priority: P1)

Reception opens the Appointments page and sees today's appointments across the clinic. They can change the dates, or narrow the list by doctor, patient, or status, and open any appointment to see everything recorded about it.

**Why this priority**: Booking is only useful if an appointment can be found again to confirm, change, or cancel it. With User Story 1 this is the smallest usable clinic workflow.

**Independent Test**: With synthetic appointments across two doctors and two days, open the page and confirm it shows today's. Then filter by each filter in turn, reload, and go back, confirming the same results each time. Open one appointment and confirm every recorded field.

**Acceptance Scenarios**:

1. **Given** the page is opened with no filters, **When** it appears, **Then** it lists today's appointments for all doctors and every status, in the API's order, each showing date, start, end, status, doctor, and the patient's number, name, and phone.
2. **Given** a date range, doctor, patient, or status is applied, **When** results appear, **Then** they match, and the filters and page number survive a reload and the back button.
3. **Given** a person filters by patient, **When** they search and choose one, **Then** the list narrows to that patient and shows who was chosen, no opening is written, and only the patient number appears in the address.
4. **Given** the "View appointments" link on a patient's page, **When** it is followed, **Then** the list shows that patient's appointments from today to 90 days ahead, and earlier dates can be reached by changing the range.
5. **Given** a range of more than 92 days, or one that ends before it starts, **When** it is applied, **Then** the API's message appears on the matching filter.
6. **Given** no appointments match, **When** the list finishes, **Then** an empty state says so, keeps the filters, and offers to book.
7. **Given** a person opens an appointment, **When** the page appears, **Then** it shows the date, times, status, doctor, patient, note, who booked it and when, the last reschedule if any, the last status change if any, and the cancellation reason if any.
8. **Given** an optional detail has no value, **When** the page is shown, **Then** it says "not recorded" or leaves out that history line, and never shows a blank or a false value.
9. **Given** an appointment number that doesn't exist, or an address that isn't a valid number, **When** it is opened, **Then** the neutral not-found state appears.
10. **Given** a patient's name on an appointment's page, **When** a person follows it, **Then** the patient's record opens and writes one true opening. Showing or hovering over the name writes nothing.
11. **Given** a change made on an appointment's page, **When** the person returns to a list that showed it, **Then** the list shows the new values without a manual reload.

---

### User Story 3 - Handle appointments outside a doctor's availability (Priority: P2)

An administrator changes a doctor's hours or records time off. Appointments already booked stay as they are, and the API flags those that no longer fit. Reception needs to find them and move or cancel each one, then contact the patient, because the system doesn't notify anyone.

**Why this priority**: Without this, a patient can arrive for a doctor who isn't there. The clinic can begin booking without it, but not run for long.

**Independent Test**: Book a synthetic appointment, then record time off covering it. Confirm it's flagged in the list and on its page, and that the "needs moving" view finds it. Reschedule it, and confirm the flag and its place in that view are gone.

**Acceptance Scenarios**:

1. **Given** an appointment the API marks as outside availability, **When** it appears in a list or on its page, **Then** a text label says so, not color alone.
2. **Given** the Appointments page, **When** a person chooses to see only appointments needing a move, **Then** the list shows those the API returns from today to 90 days ahead, and other filters can still narrow it.
3. **Given** a flagged appointment's page, **When** it is shown, **Then** it explains that the appointment still stands, that the patient isn't told automatically, and offers to reschedule or cancel.
4. **Given** a flagged appointment was rescheduled or cancelled, **When** the person returns to the "needs moving" view, **Then** it's no longer listed.

---

### User Story 4 - Reschedule an appointment (Priority: P2)

A patient can't come at the booked time. Reception moves the appointment to another free time with the same doctor, and the old time becomes free again. Moving to a different doctor means cancelling and booking again, because the API doesn't allow reassignment.

**Why this priority**: Changes are daily work, though a clinic could cope for a short time by cancelling and rebooking.

**Independent Test**: Reschedule a synthetic appointment, then confirm its new date and times, that its number is unchanged, that the old time is offered again, and that the page shows who moved it and when. Provoke each refusal.

**Acceptance Scenarios**:

1. **Given** a scheduled appointment that hasn't started, **When** the person starts to reschedule, **Then** the current date and time remain visible, and the same doctor's free times appear, using the same seven-day view as booking.
2. **Given** a new time is chosen, **When** it is submitted, **Then** the appointment moves, a confirmation appears, and the page shows its new date and time.
3. **Given** the chosen time was taken, or the patient is busy then, **When** it is submitted, **Then** the API's message appears, the free times are read again, and the appointment is unchanged.
4. **Given** the appointment became impossible to change, for example because someone else cancelled it, **When** it is submitted, **Then** the API's message appears at form level, and the page shows the appointment's current state.
5. **Given** rescheduling is under way, **When** the person cancels it, **Then** the appointment's page returns as it was.

---

### User Story 5 - Cancel an appointment (Priority: P2)

A patient cancels. Reception records it, optionally with a reason, and the time is offered again. A cancelled appointment stays on record and can't be restored.

**Why this priority**: As with rescheduling, this is daily work, and it frees time for other patients.

**Independent Test**: Cancel a synthetic appointment with a reason, then confirm its status, reason, and who cancelled it and when, and that the time is offered again.

**Acceptance Scenarios**:

1. **Given** a scheduled appointment that hasn't started, **When** the person chooses to cancel, **Then** a confirmation says it can't be undone, and offers an optional reason of up to 255 characters, with a hint not to enter medical details.
2. **Given** the person confirms, **When** the API accepts, **Then** the page shows the cancelled appointment, with a confirmation.
3. **Given** the person dismisses the confirmation, **When** it closes, **Then** nothing changes, and focus returns to the control that opened it.
4. **Given** the appointment can no longer be changed, **When** cancelling is confirmed, **Then** the API's message appears, and the page shows the appointment's current state.

---

### User Story 6 - Record that a patient didn't come (Priority: P3)

A booked patient never arrived. Once the appointment's start has passed, reception marks it as a no-show. This can't be undone.

**Why this priority**: It keeps records and later reports honest, but booking works without it.

**Independent Test**: Mark a synthetic appointment whose start has passed as a no-show, then confirm its status and who marked it and when. Force the action on one that hasn't started, and confirm the API's refusal appears.

**Acceptance Scenarios**:

1. **Given** a scheduled appointment whose start has passed, **When** its page is shown, **Then** "No-show" is offered, while reschedule and cancel are not.
2. **Given** a scheduled appointment that hasn't started, **When** its page is shown, **Then** "No-show" isn't offered.
3. **Given** the person chooses "No-show", **When** the confirmation appears, **Then** it says this can't be undone, and only confirming records it.
4. **Given** the screen's view of the time or status was out of date, **When** the API refuses, **Then** its message appears, and the page shows the appointment's current state.

---

### User Story 7 - A doctor sees their own appointments (Priority: P2)

A doctor opens "My appointments" to see who's booked with them and when, and can open one for its details. They can't change anything, and see only what the API allows them: the patient's number, name, sex, and date of birth.

**Why this priority**: Doctors need to know who's coming, though nothing about reception's work depends on it.

**Independent Test**: As a synthetic doctor with appointments alongside another doctor's, confirm only their own appear, that no phone or other contact detail appears anywhere, and that no action is offered. Then try another doctor's appointment by its address.

**Acceptance Scenarios**:

1. **Given** a doctor with a profile, **When** they open "My appointments", **Then** today's own appointments of every status appear, each with date, start, end, status, and the patient's number, name, sex, and date of birth.
2. **Given** the date range or status filter is applied, **When** results appear, **Then** they match, and the filters and page number survive a reload and the back button.
3. **Given** a doctor opens one of their appointments, **When** the page appears, **Then** it adds the note and when it was booked, and offers no actions and no link to a patient record.
4. **Given** another doctor's appointment number, **When** it is opened through the doctor's own pages, **Then** the neutral not-found state appears.
5. **Given** a doctor account with no profile yet, **When** it opens "My appointments", **Then** the "profile not set up, contact an administrator" state appears.
6. **Given** an appointment the API marks as outside availability, **When** the doctor sees it, **Then** a text label says so.

---

### User Story 8 - Roles and refusals (Priority: P1)

Administrators and receptionists have the same appointment access. Doctors have only their own read-only pages. A role changed during a session is handled by whatever the API answers.

**Why this priority**: The API's rules separate reception from clinical roles, and the application mustn't suggest otherwise.

**Independent Test**: Sign in as each role and compare every appointment page and action against the verified permission matrix, then force a refused action and confirm what appears.

**Acceptance Scenarios**:

1. **Given** a doctor, **When** they open a staff appointment address, **Then** the "not allowed" state appears, and no appointment is read.
2. **Given** an administrator or receptionist, **When** they open a doctor's own appointment address, **Then** the "not allowed" state appears.
3. **Given** a role changed mid-session, **When** the API answers `403` to a read or an action, **Then** the "not allowed" state or message appears, whatever the screen believed, and any patient details already on that screen are removed.
4. **Given** the session ends, **When** the person signs in again, **Then** no patient record is opened on their behalf, and the return address doesn't carry a patient number.
5. **Given** a person signs out, **When** anyone uses that computer next, **Then** no appointments, patient details, search terms, or notes remain, whether on screen, in hidden pages, or in browser storage.

---

### Edge Cases

- A time on an open page passes its start: the screen may still offer reschedule or cancel, and the API's refusal then appears, and the page shows the current state. No background reading or timer is used to catch this.
- Free times are shown, then time passes or someone else books: the free times aren't polled. The API's answer on submitting decides, and the person can choose to refresh them.
- A doctor who became inactive: existing appointments can still be viewed, cancelled, or marked as no-show. They have no free times, so rescheduling shows the neutral empty state. To move the patient to another doctor, cancel and book again.
- The API gives the same empty list for a doctor with no schedule, an inactive doctor, and a fully booked week, so the screen can't and doesn't claim which it is.
- A time overlapping the appointment's own current time isn't offered when rescheduling, because the API's free times leave out every booked time. This only arises after a doctor's appointment length changed. The person can choose another time, or cancel and rebook.
- A patient with two appointments on one day: this is allowed if they don't overlap.
- A chosen patient, or a patient number in the address, that doesn't exist or isn't a valid number: the screen says no patient was found, and offers the search. The record isn't read to find out.
- The connection fails while booking, so the outcome is unknown: the screen says it can't tell whether the booking was saved, and offers a link to that patient's appointments before trying again. Submitting again can't double-book, as the API would refuse it as a conflict.
- The connection fails while rescheduling, cancelling, or marking a no-show, so the outcome is unknown: the screen says it can't tell whether the change was saved, and refreshes, so the page shows the appointment's real state.
- An audit entry can't be saved: the API answers `500` and the action did not happen. A general error appears, and the application doesn't claim otherwise.
- Midnight during booking, or a computer in another time zone: "today" and "has started" use the clinic's clock, and the API decides. Dates and times are shown as sent, including an end of `24:00`.
- A seven-day view that would pass the 90-day limit: the view stops at the limit, and no later week is offered.
- Long names, long notes, or long reasons: they wrap without breaking the page, in their own direction.
- An appointment with status `checked_in` or `completed`, which Phase 7 and later will create: it's shown with its translated status, and offers no action.
- A staff reference with no value: it says "not recorded".
- The session ends during a form: the usual sign-in redirect applies, and what was typed isn't kept in browser storage.
- Going back to a held booking page before submitting: what was typed is still there, until sign-out. It isn't written to browser storage.

## Requirements *(mandatory)*

### Functional Requirements

**Booking**

- **FR-001**: Administrators and receptionists MUST be able to book a patient with a doctor at a free time, with an optional note of up to 500 characters that carries a visible "no medical details" hint.
- **FR-002**: Choosing a patient for booking or filtering MUST use search by name, phone, patient number, or national ID, following Phase 5's rules: all four fields labelled, sent on submit, and terms kept out of addresses, titles, logs, and browser storage.
- **FR-003**: Choosing a patient MUST NOT open their record or write an opening. A patient chosen or carried forward MUST be shown using list fields only, read in a way the API doesn't audit.
- **FR-004**: The booking page MUST offer active doctors only, findable by name or specialty.
- **FR-005**: Free times MUST be shown for seven days from a chosen date, defaulting to the clinic's today, grouped by day, with next and previous week. Dates before today or more than 90 days ahead MUST NOT be requested.
- **FR-006**: Free times MUST be read when a doctor is chosen, when the dates change, when the person asks to refresh, and after a refusal about the time. They MUST NOT be polled.
- **FR-007**: The application MUST NOT calculate free times itself or decide conflicts itself. The API's answer MUST decide.
- **FR-008**: On a conflict, the API's message MUST appear, the free times MUST be read again, the chosen time MUST be cleared, and everything else typed MUST be kept. When the conflict's reason is that the patient is busy, a link MUST lead to that patient's appointments on that date.
- **FR-009**: After booking, the application MUST show the appointment's page with a confirmation, and the booking form MUST be empty when next visited.
- **FR-010**: Registering a patient MUST be reachable from the patient search when no match is found.

**List and details**

- **FR-011**: The Appointments page MUST open on today's appointments for all doctors and every status, and MUST offer filters for date range, doctor, patient, one status, and needing a move.
- **FR-012**: Filters and page number MUST live in the page's address, so they survive a reload and the back button. A patient MUST appear there only as a patient number.
- **FR-013**: The doctor filter MUST include inactive doctors, whose existing appointments may still need handling.
- **FR-014**: The "needing a move" view MUST cover from today to 90 days ahead unless the person changes the dates, and MUST NOT offer a way to ask for "not outside availability".
- **FR-015**: Lists MUST use the API's order and totals. No sort control MUST be offered (backend gap G4).
- **FR-016**: An appointment's page MUST show every field the API returns for it. Lists MUST NOT show a note or a patient's sensitive fields, which the API doesn't send.
- **FR-017**: A patient's name on an appointment's page MUST link to their record through the link that records a person's click, and MUST NOT read the record ahead of that click.

**Changes**

- **FR-018**: Reschedule MUST use the same doctor and the same free-time view as booking, with the current date and time visible. No way of choosing another doctor MUST be offered.
- **FR-019**: Cancel MUST ask for confirmation, say that it can't be undone, and offer an optional reason of up to 255 characters with a "no medical details" hint.
- **FR-020**: No-show MUST ask for confirmation and say that it can't be undone.
- **FR-021**: On a scheduled appointment, the page MUST offer reschedule and cancel until its start passes on the clinic's clock, and no-show from then on. Any other status MUST offer no action. This only decides what's offered: the API's answer MUST win.
- **FR-022**: After any change, the page MUST show the appointment's new state, and lists MUST show new values when returned to. Reading an appointment again to do so is allowed, as it isn't audited.
- **FR-023**: Check-in MUST NOT be offered in this phase. It belongs to Phase 7.

**Patient page**

- **FR-024**: The patient's page MUST gain "Book appointment" and "View appointments" links, including when a record is shown after registering. It MUST NOT show any appointment information itself. This narrows Phase 5's FR-032, whose other exclusions stay.
- **FR-025**: These links MUST NOT cause any further read of the record, and following them MUST write no opening.

**Doctors**

- **FR-026**: Doctors MUST be able to list their own appointments, opening on today with every status, filtered by date range and one status, and open one. These pages MUST offer no action and no link to a patient record.
- **FR-027**: Doctors MUST see only what the API returns for them. They MUST NOT see a patient's phone or any other contact detail.
- **FR-028**: A doctor with no profile MUST see the existing "profile not set up" state on these pages.

**Access**

- **FR-029**: This phase's real pages MUST replace the "not available yet" placeholders for Appointments and My appointments. Later phases' placeholders MUST stay as they are.
- **FR-030**: Page access and controls MUST follow the single role map. The API's `401`, `403`, and `404` MUST be handled on every screen and action, whatever the map says.
- **FR-031**: A person's return after sign-in MUST NOT open a patient's record and MUST NOT carry a patient number.
- **FR-032**: Signing out MUST leave no appointments, patient details, search terms, or notes in hidden pages, memory, or browser storage.

**Cross-cutting**

- **FR-033**: Every view MUST provide loading, error, empty, and success states, using the shared design system, with all text in both languages and working in both directions.
- **FR-034**: Every change MUST show progress, prevent double submission, show the API's message on the matching field or otherwise at form level, and confirm success. The application MUST branch only on status, the error's field key, and a conflict's `reason`, never on message text.
- **FR-035**: Statuses MUST be translated by the application and shown with the shared status mapping. Names, notes, and reasons MUST appear as written, in their own direction.
- **FR-036**: Clinic dates and wall-clock times MUST be shown as sent. Booked, rescheduled, and status-changed moments MUST be shown in the clinic's time zone.
- **FR-037**: Free times MUST be operable by keyboard, and each MUST have a name that gives its date and time to assistive technology.
- **FR-038**: Note, reason, and patient search fields MUST ask the browser not to remember or suggest what was typed.
- **FR-039**: Patient details, notes, reasons, and search terms MUST NOT be written to logs, analytics, or error reports, and tests MUST use synthetic data only.
- **FR-040**: Digits typed in Arabic form MUST be converted to Western digits in number and phone search fields before sending. Names, notes, and reasons MUST NOT be altered.

### Key Entities

- **Appointment**: A patient booked with a doctor for one free time. It has a number, date, start, end, status, and an outside-availability flag. Its page adds the note and who booked, moved, or changed it, and when. Never deleted.
- **Free time**: A date, start, and end the API currently offers for a doctor. It's worked out by the API, never stored or calculated here, and can be taken at any moment.
- **Appointment status**: `scheduled`, `cancelled`, `no_show`, `checked_in`, or `completed`. Only `scheduled` can be changed, and the last two are only displayed in this phase.
- **Outside availability**: The API's flag on a scheduled appointment that hasn't started, and no longer fits the doctor's hours or time off, or whose doctor is inactive. It's not a status, and the appointment still stands.
- **Conflict reason**: The API's only machine-readable refusal: the time is booked, or the patient is busy.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A receptionist can find a known patient, choose a doctor, and book a free time in under 1 minute, using only the application.
- **SC-002**: When two people book the same time against the real API, exactly one succeeds, and the other sees why and can pick another time without retyping anything, in 100% of test runs.
- **SC-003**: Across a scripted journey covering booking, filtering by patient, rescheduling, cancelling, and marking a no-show, the patient opening entries added are exactly those a person asked for by following a link to a record, and each change adds exactly one matching appointment entry.
- **SC-004**: After a schedule or time-off change affecting a booked appointment, reception can find it in the "needing a move" view and move it in under 1 minute.
- **SC-005**: A search of the address history, browser storage, and application logs after a full journey finds no synthetic search term, note, reason, or patient detail, other than patient numbers in addresses.
- **SC-006**: For each role, 100% of appointment pages and controls agree with the verified permission matrix, by automated comparison, and a forced action refused by the API shows a clear state.
- **SC-007**: Every refusal the API can give on these forms appears on the correct field or at form level, with zero dropped, in both languages.
- **SC-008**: Every screen shows correct loading, error, empty, and success states, in both languages and directions.
- **SC-009**: Automated accessibility checks report no WCAG 2.2 AA violations on the new screens in either language or direction, and booking, rescheduling, cancelling, and marking a no-show can each be finished by keyboard alone.
- **SC-010**: Every appointment operation is exercised against the running API, with its fields and statuses confirmed to match the contract.
- **SC-011**: Every quality check passes, and results recorded for this phase are ones actually observed.

## Assumptions

- Check-in stays in Phase 7. The blueprint lists it under appointments, but the API places it with the queue, and it creates a queue entry, which Phase 7's screens own. The blueprint is to be updated.
- Booking and rescheduling need no confirmation dialog: a mistake can be corrected by rescheduling or cancelling, the choices are visible when submitting, and a dialog on every booking would slow the desk. This follows the reasoning in ADR 0012. Cancel and no-show can't be undone, so they ask.
- Administrators see the same appointment screens as receptionists, as the API draws no distinction between them.
- Actions appear only on an appointment's page, not in list rows, so that each change is made with the full details in view. End-of-day no-shows take one page each.
- Patients aren't notified by the system, because the API has no notifications. The screen says so where it matters.
- A cancellation reason stays optional, as the API defines it.
- Reading appointments and free times isn't audited, verified in the backend's source, so ordinary reading and refreshing are safe here. Only following a link to a patient's record writes an opening.
- Appointment pages keep their state when hidden, as visited pages do, until sign-out clears them.
- Live end-to-end tests run against the Docker backend with synthetic data. The audit trail is read through the API by a test administrator, because the audit screen arrives in Phase 11. An appointment whose start has passed can't be booked, so tests that need one must arrange it without changing the backend's code.

### Out of scope

Check-in, walk-ins, and queue screens; encounters and charges; moving an appointment to another doctor; overbooking; undoing a cancellation or no-show; patient notifications and reminders; printing; a calendar or timetable view of a doctor's day; bulk actions on several appointments; dashboards, which arrive in Phase 12; warnings about unsaved changes when leaving a form; and any backend change.
