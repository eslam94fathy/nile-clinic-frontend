# Feature Specification: Medical Encounters

**Feature Branch**: `008-medical-encounters`

**Created**: 2026-11-07

**Status**: Accepted

**Input**: User description: "Start Phase 8" of `docs/roadmap.md`: medical encounters. Draft, save strategy, finalize, addenda, history. The most sensitive phase, and it gets a dedicated privacy review.

## Clarifications

### Session 2026-11-07

- Q: How should a draft be saved? → A: Only when the doctor chooses to, with an always-visible unsaved notice and a warning before leaving. There's no automatic save, so a browser crash or power cut loses what was typed since the last save. The owner accepted that, so that each audit entry is a deliberate save.
- Q: Should calling a patient start their record automatically? → A: No. Calling offers "Start record" as one further click, with no confirmation, so a mistaken call leaves no permanent empty record.
- Q: Where should the history and earlier records open while writing a draft? → A: In a panel beside the draft on the same page, opened by a click.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Write the record of a visit (Priority: P1)

A patient is with the doctor. From "My queue", the doctor starts that visit's record, writes what they learn as the visit goes on, and saves as often as they need. A partly written record is fine. If the clinic is busy, they can finish the visit and complete the record later.

**Why this priority**: Nothing else in this phase exists until a record can be written.

**Independent Test**: As a synthetic doctor with a patient with them, start a record, save planted synthetic text, reload, and confirm the text is there and the record is a draft. Confirm the audit trail gained `encounter.started` and `encounter.draft_saved`, then one `encounter.opened` for the reload, and none before it.

**Acceptance Scenarios**:

1. **Given** a patient is with the doctor and their visit has no record, **When** "My queue" is shown, **Then** "Start record" is offered for that patient, with no confirmation. Calling a patient never starts a record by itself.
2. **Given** the doctor starts a record, **When** the API accepts, **Then** the record appears for writing, using what the API returned, with no further read and no `encounter.opened`.
3. **Given** a draft is shown, **When** it appears, **Then** it shows the visit's date, the patient's number, name, sex, and date of birth, and the fields for chief complaint, examination findings, diagnosis, treatment plan, and prescription lines. It never shows the patient's phone, national ID, address, or emergency contact.
4. **Given** the doctor has changed something, **When** the page is shown, **Then** it says clearly that there are unsaved changes, and when the record was last saved.
5. **Given** the doctor saves, **When** the API accepts, **Then** a confirmation appears, the page uses the record the API returned, with no further read, and the unsaved notice clears. Nothing is ever saved except by the doctor choosing to.
6. **Given** nothing has changed since the last save, **When** the doctor chooses to save, **Then** nothing is sent, and the page says everything is already saved.
7. **Given** the API refuses a save, **When** its answer arrives, **Then** each message appears on its field, including on the right prescription line, others appear at form level, and everything typed stays.
8. **Given** a prescription line with no text in it, **When** the record is saved, **Then** that line isn't sent, and messages for the other lines still reach the right line on screen.
9. **Given** the doctor has unsaved changes, **When** they try to leave by any route, including a link, the back button, closing the tab, reloading, switching language, or signing out, **Then** they are warned first, and can stay.
10. **Given** a visit is finished, or is from an earlier day, and has no record, **When** the doctor starts one, **Then** it works as it does during the visit.
11. **Given** a visit that gained a record elsewhere, for example in another tab, **When** the doctor tries to start one, **Then** the API's message appears, the visit's state is read again, and a way to open the existing record is offered.

---

### User Story 2 - Finalize a record (Priority: P1)

When the record is complete, the doctor finalizes it. From then on it's the clinic's dependable account of that visit and can't be changed.

**Why this priority**: A record that can still change can't be relied on. With User Story 1, this is the smallest usable slice of the phase.

**Independent Test**: Finalize a complete synthetic draft with unsaved changes on screen. Confirm the saved text is the text on screen, the record shows as finalized with its time, no way to edit it is offered, and the audit trail gained `encounter.draft_saved` and `encounter.finalized`, and no `encounter.opened`.

**Acceptance Scenarios**:

1. **Given** a draft, **When** the doctor chooses to finalize, **Then** a confirmation says this can't be undone, that later corrections can only be added as addenda, and that it doesn't finish the visit.
2. **Given** there are unsaved changes, **When** the doctor confirms, **Then** the changes are saved first, and the record is finalized only if that save is accepted, so what's locked is what's on screen.
3. **Given** the save is refused, **When** its answer arrives, **Then** nothing is finalized, the messages appear on their fields, and everything typed stays.
4. **Given** the API refuses because something required is missing, **When** its answer arrives, **Then** each message appears on its field, including on the right prescription line, and the record stays a draft.
5. **Given** the API accepts, **When** its answer arrives, **Then** a confirmation appears, and the page shows the record the API returned, read only, with no further read.
6. **Given** a record that was already finalized elsewhere, **When** the doctor tries to save or finalize, **Then** the API's message appears, and everything typed stays on screen, with an explicit way to open the record as it now stands, read only, in the panel beside the text.
7. **Given** a record is finalized while the patient is with the doctor, **When** "My queue" is next shown, **Then** the visit is still in progress, and the record shows as finalized.

---

### User Story 3 - Find visits and open records (Priority: P2)

At the end of a busy day, the doctor wants to see which visits still have no record or an unfinished draft, and to reopen any record they wrote.

**Why this priority**: Records written after the visit get forgotten without this, but a doctor who writes during each visit can manage without it at first.

**Independent Test**: Give a synthetic doctor three visits, one with no record, one with a draft, and one finalized. Filter "My visits" by each status, reload, and go back, confirming the results each time. Confirm showing, hovering over, and filtering rows writes no audit entry, and that clicking one writes exactly one `encounter.opened`.

**Acceptance Scenarios**:

1. **Given** "My visits" is opened with no filters, **When** it appears, **Then** it lists the doctor's visits from the last 30 days up to the clinic's today, in the API's order, with no clinical content.
2. **Given** a row, **When** it is shown, **Then** it gives the visit's date, whether it was a walk-in, the times of arrival, calling, and finishing where they exist, the record's status as text, and the patient's number, name, sex, and date of birth.
3. **Given** a date range or a record status is chosen, **When** results appear, **Then** they match, and the filters and page survive a reload and the back button. A range the API refuses shows its message on the field.
4. **Given** a row, **When** it is shown, **Then** it offers starting a record if there's none, continuing it if it's a draft, or opening it if it's finalized.
5. **Given** no visit matches, **When** the list finishes, **Then** a neutral empty state keeps the filters.
6. **Given** a person opens a record by following a link, **When** it appears, **Then** exactly one `encounter.opened` is written. Hovering over the link, focusing the tab, reconnecting, going away and back, and any refresh elsewhere write nothing.
7. **Given** a record the person may not read, or that doesn't exist, **When** it is opened, **Then** one neutral not-found state appears, saying nothing about whether it exists.
8. **Given** "My queue" is shown, **When** a patient is with the doctor or has been seen today, **Then** their row shows the record's status, and showing or refreshing it writes no opening. A failure to read this leaves the queue working, with the status left out and a message.

---

### User Story 4 - Read a patient's earlier records (Priority: P2)

Before or during a visit, the doctor wants to know the patient's history: earlier diagnoses, treatments, and medications, including those written by other doctors the API allows.

**Why this priority**: Continuity of care is a major reason to keep records, but a doctor can write new records without it.

**Independent Test**: Have another synthetic doctor finalize a record for a patient on this doctor's list today. Open the history, confirming the row has only a date, a doctor's name, and specialties. Open the record, confirming it's read only, and confirm one `encounter.history_viewed` and one `encounter.opened`. Mark the patient as left, and confirm the next opening gives the neutral not-found state.

**Acceptance Scenarios**:

1. **Given** a patient on the doctor's list today, or a visit whose record the doctor has finalized, **When** it is shown, **Then** a way to open that patient's history is offered, and nothing is read until a person chooses it.
2. **Given** a visit where the API would be expected to refuse, **When** it is shown, **Then** no way to open the history is offered, because a refused attempt writes its own permanent audit entry.
3. **Given** the doctor opens a history, **When** it appears, **Then** it lists records newest first, in the API's pages, each with its date, the doctor's name, and their specialties in the current language, with no clinical content.
4. **Given** each further page of a history, **When** a person asks for it, **Then** it reads once, and writes its own true `encounter.history_viewed`.
5. **Given** a patient on the doctor's list today with no earlier records, **When** the history finishes, **Then** a neutral empty state says none can be shown.
6. **Given** a history the API refuses, **When** its answer arrives, **Then** the same neutral not-found state appears, saying nothing about whether records exist.
7. **Given** another doctor's finalized record, **When** it is opened, **Then** it shows the author's name and title and every addendum, read only, offering nothing to change.
8. **Given** the doctor is writing a draft, **When** they open the patient's history, **Then** it opens in a panel beside the draft, and the draft and anything unsaved stay as they were. An earlier record chosen there opens read only in the same panel. On a narrow screen the panel may cover the form until it's closed, and the form keeps everything typed.
9. **Given** the panel is closed and opened again, **When** a person asks for the history or a record again, **Then** it reads once more, and writes a true entry. Opening a draft never opens the panel or reads anything in it by itself.

---

### User Story 5 - Correct a finalized record (Priority: P3)

The doctor notices a mistake in a record they finalized, or learns something later that matters, such as a lab result. The original stays as written, and the correction is added with its time.

**Why this priority**: Corrections are needed for an accurate record, but they're rarer than writing and reading.

**Independent Test**: As the author of a finalized synthetic record, add an addendum, confirming the original is unchanged, the addendum appears with its time and no further read, and the audit trail gained `encounter.addendum_added` and no `encounter.opened`.

**Acceptance Scenarios**:

1. **Given** the author views their finalized record, **When** it is shown, **Then** adding an addendum is offered, and every addendum so far is shown, oldest first, each with its time.
2. **Given** the author submits an addendum, **When** the confirmation appears, **Then** it says an addendum can't be changed or removed, only followed by another.
3. **Given** the API accepts, **When** its answer arrives, **Then** a confirmation appears, the addendum joins the list using what the API returned, with no further read, and the field is empty.
4. **Given** the API refuses, **When** its answer arrives, **Then** its message appears on the field, and the text stays.
5. **Given** a draft, or another doctor's record, **When** it is shown, **Then** no addendum is offered. If the API is reached anyway, its `422` or `403` message appears, and nothing changes.
6. **Given** the author has typed an addendum and not submitted it, **When** they try to leave, **Then** they are warned first, as with a draft.

---

### User Story 6 - Keep clinical content to the people and places allowed (Priority: P1)

Only a doctor sees clinical content, and only what the API returns to them. Administrators and receptionists see no clinical screen, and no sign of whether a record exists. Clinical text stays out of everything that outlives the screen, and a dedicated privacy review confirms it before this phase is accepted.

**Why this priority**: This is the most sensitive information the clinic holds. A failure here can't be undone, as a leaked record stays leaked.

**Independent Test**: Plant recognisable synthetic text in every field of a record, an addendum, and a prescription. Go through every journey, then search every address visited, page title, browser storage, browser cache of responses, the server's output, and the audit trail for it, confirming none is there. Sign out, press back, and confirm nothing appears.

**Acceptance Scenarios**:

1. **Given** an administrator or receptionist, **When** they open a clinical address directly, **Then** the not-allowed state appears, and no read is made. Their navigation has no clinical entry.
2. **Given** an administrator or receptionist on any existing screen, **When** it is shown, **Then** it gives no record status, count, or link, and the patient's page and the Queue page stay as they are.
3. **Given** a doctor with no profile, **When** they open a clinical screen, **Then** the "profile not set up, contact an administrator" state appears, and no further read is made.
4. **Given** a doctor's permission changes while a page is open, **When** the API answers `401`, `403`, or `404`, **Then** the matching state or message appears, and whatever the UI believed doesn't matter.
5. **Given** the doctor signs out, or the session ends, **When** the back button is pressed, **Then** no clinical content or patient detail appears, and signing in doesn't return anyone to a clinical address.
6. **Given** clinical text is being typed, **When** the browser could offer to remember or check it, **Then** the fields ask it not to remember what's typed, and not to send it to a spell-checking service.
7. **Given** any clinical page, **When** its title, address, or a message is produced, **Then** it holds no clinical text, and the title holds no patient name. Only the record's or patient's number may appear in an address.
8. **Given** Phase 8's work is otherwise complete, **When** it is put forward for acceptance, **Then** a written privacy review exists, covering each area in FR-045, with what was checked, how, what was found, and what remains open for the owner to accept.

---

### Edge Cases

- **Saving twice from two tabs.** The API has no version check, so the last save replaces the earlier one, with no warning possible at the time. Finalizing takes no content, so it locks what was last saved, which may be another tab's. After finalizing, the page shows what the API returned, not what was on screen, and says so if they differ. Recorded as a gap.
- **Saving when the answer never arrives.** The save may or may not have happened. The page says so, keeps everything typed, and never re-sends or re-reads by itself. Saving again is safe, as it replaces the content.
- **Finalizing or adding an addendum when the answer never arrives.** The page says it isn't known whether it happened, and offers opening the record, which is a person's action and writes a true opening. Adding the same addendum again blindly could add it twice, and the message says so.
- **A `500` on any change.** The API says nothing happened. The message says so, and what was typed stays.
- **The session ending during a save.** The API answers `401`. The page says the session ended and nothing was saved, and keeps what was typed on screen until the person chooses to sign in, so they can copy it by hand. Nothing is stored, so it can't survive signing in. The privacy review must weigh this against the text staying on an unattended screen.
- **Another tab signing out.** This tab leaves at once, and anything unsaved is lost with no warning. A person who signs out on a shared computer means it, so the clinical text goes with them.
- **Another tab finding the session has ended by itself.** Nobody chose this, so a tab with unsaved text behaves as the session ending during a save does. A tab with nothing unsaved leaves at once.
- **Opening the panel after the session has ended.** The same: the text stays, and the page says the session ended.
- **A save refused with `403` or `404`.** The page isn't re-decided while text is at risk, so the text stays, with the message, until the person leaves.
- **Typing while a save runs.** Fields are read-only until the answer arrives, so nothing typed can be overwritten by it.
- **An unattended screen.** A record on screen stays there, because roadmap decision Q2 chose no inactivity sign-out, and a record page makes no requests that could notice a session ending. Q2 was decided for the front desk. The privacy review must put the question again for clinical content, and the owner decides.
- **Access ending while a record is on screen.** Another doctor's record stays on screen until the person leaves it, even if the patient is marked as left, as ADR 0005 accepts. Opening it again gives the not-found state and a true refusal entry.
- **Opening someone else's draft.** The same neutral not-found state as anything else not readable.
- **The address of a record, opened by reload, a language switch, or going back after a page is no longer held.** Each reads once, and writes one true opening, as ADR 0012 records. Going back to a held page reads nothing.
- **A visit still with the doctor from an earlier day.** It appears in "My visits", and its record can be written and finalized. It doesn't extend access to other doctors' records.
- **A patient with no history link.** A visit from another day, with no finalized record of this doctor's, offers no history, even though other doctors' records may exist, as the API would refuse.
- **Finishing a visit with no finalized record.** It's allowed. The confirmation adds, without blocking, that the record isn't finalized and can be completed later.
- **Language of clinical text.** Written in any language, shown exactly as written with its line breaks, never translated, and each piece of text takes its own direction, so Arabic and English read correctly in either interface language.
- **Very long text.** Up to 10,000 characters per field, 500 per prescription field, and 20 lines. The form shows the limits as a hint, and the API's answer decides. Unbroken text wraps rather than widening the page.
- **Patient details changed since.** The record shows the summary the API sends now. Clinical text doesn't change.
- **Printing.** Not offered (roadmap decision Q5). A person can still print a page with the browser, which this phase can't prevent.
- **A deactivated author.** Their finalized records stay readable by other doctors under the same rule, read only. Their own session ends, so they get `401`.
- **A crash or power cut while writing.** What was typed since the last save is lost, and the system can't recover it, as nothing is kept in browser storage. The owner accepted this. The unsaved notice is the protection, and the privacy review records it as an accepted risk.

## Requirements *(mandatory)*

### Functional Requirements

**Starting**

- **FR-001**: A doctor MUST be able to start the record of their own visit that is with them or seen, on the visit's day or later, from "My queue" and "My visits".
- **FR-002**: Starting MUST use the record the API returns, with no further read and no `encounter.opened`.
- **FR-003**: Calling a patient MUST NOT start a record. Starting MUST be the doctor's own action, with no confirmation, MUST NOT change the visit's status, and a record MUST NOT be required to finish a visit.
- **FR-004**: If the API refuses to start, the system MUST show its message, read the visit's state again, and offer the existing record if there is one. It MUST NOT tell apart reasons from the message's wording.

**Writing and saving**

- **FR-005**: A draft MUST offer chief complaint, examination findings, diagnosis, treatment plan, and up to 20 prescription lines of medication, dosage, frequency, duration, and instructions. Lines MUST be addable and removable.
- **FR-006**: Every save MUST send every field, with empty ones as nothing, as the API replaces the whole draft. A line with no text MUST NOT be sent.
- **FR-007**: A draft MUST be saved only by the doctor's own action, either saving or confirming a finalization, never on a timer, on leaving a field, or on leaving the page. A save MUST NOT be sent when nothing has changed.
- **FR-008**: The page MUST always show whether there are unsaved changes, and the time of the last save in the clinic's time zone.
- **FR-009**: The system MUST warn before unsaved text is lost by any route listed in User Story 1's scenario 9.
- **FR-010**: Every refusal MUST appear on its field, including the right line on screen, or at form level if no field matches, and MUST keep everything typed. Saving and finalizing MUST show progress, and MUST prevent a second submission.
- **FR-011**: Nothing MUST be re-sent or re-read by itself after a change fails or its answer never arrives.

**Finalizing**

- **FR-012**: Finalizing MUST ask for confirmation, saying it can't be undone, that corrections can only be added as addenda, and that it doesn't finish the visit.
- **FR-013**: Unsaved changes MUST be saved first, and finalizing MUST go ahead only if that save was accepted.
- **FR-014**: After finalizing, the system MUST show what the API returned, read only, with its finalized time, and MUST say so if it differs from what was on screen.
- **FR-015**: The system MUST NOT decide for itself whether a record is complete. It MUST send the request and show the API's answer on the fields.

**Lists**

- **FR-016**: "My visits" MUST list the doctor's visits from the API, with filters for date range and record status, defaulting to the last 30 days up to the clinic's today. Filters and page MUST be held in the address and survive a reload and going back.
- **FR-017**: "My visits" MUST keep the API's order, and offer no sorting.
- **FR-018**: Every row MUST offer the action matching its record status, and MUST NOT read a record until a person chooses it.
- **FR-019**: "My queue" MUST show the record's status for visits with the doctor or seen, MUST offer starting or opening the record for them, and MUST NOT read a record or a history to do so. A failure to read the status MUST NOT stop the queue.
- **FR-020**: The confirmation for finishing a visit MUST say, without blocking, when the record isn't finalized. This replaces Phase 7's FR-024.

**Reading**

- **FR-021**: A record MUST be read once per person's action: following a link, reloading, or asking to read it again. It MUST NOT be read by prefetching, hovering, focus, reconnecting, a timer, a refresh, or a retry, and MUST NOT be read again after a change, whose answer is used instead.
- **FR-022**: A record MUST show its status, date, author's name and title, the patient's summary, its content exactly as written, its started, last-saved, and finalized times, and its addenda, oldest first.
- **FR-023**: Instants MUST appear in the clinic's time zone, and dates as sent.
- **FR-024**: A finalized record MUST be read only, and a record by another doctor MUST offer no way to change it. An unexpected `403` or `422` MUST show its message and change nothing.
- **FR-025**: Not found MUST be one neutral state, for a record or history that doesn't exist or isn't readable, giving no hint of which.

**History**

- **FR-026**: A patient's history MUST be read only when a person asks, and each further page only when a person asks.
- **FR-027**: The way to open a history MUST be offered only where the API is expected to allow it: a patient on the doctor's list today as waiting, with the doctor, or seen, or a visit whose record this doctor has finalized. The API's answer still decides.
- **FR-028**: History rows MUST show only the date, the doctor's name, and their specialties in the current language, and MUST open the record by a person's action.
- **FR-029**: While writing, the history and earlier records MUST open by a click in a panel beside the draft, read only, and MUST NOT lose the draft or its unsaved changes. The panel MUST NOT read anything until a person asks, and MUST work by keyboard, with focus returning to where it was on closing.

**Addenda**

- **FR-030**: The author of a finalized record MUST be able to add an addendum of up to 10,000 characters, after a confirmation saying it can't be changed or removed.
- **FR-031**: An accepted addendum MUST join the list using what the API returned, with no further read. A refusal MUST keep the text.

**Access and privacy**

- **FR-032**: Clinical screens MUST be offered only to doctors, through the single permission map, and other roles MUST get the not-allowed state with no read. No screen for other roles MUST show a record's status, count, or link.
- **FR-033**: A doctor's clinical screens MUST show only the patient's number, full name, sex, and date of birth, and MUST NOT read the patient's own record to get them.
- **FR-034**: Clinical text MUST NOT appear in any address, page title, log, error report, analytics, or persistent browser storage. Only a record's or patient's number MAY appear in an address, and a filter MUST NOT hold clinical text.
- **FR-035**: Responses holding clinical content MUST NOT be stored in any shared or browser cache, and MUST NOT be placed in the server's rendered output or the client's query cache.
- **FR-036**: What's typed MUST live only in the open page's memory until saved. It MUST NOT be kept in any browser storage, even to protect against a crash.
- **FR-037**: Clinical fields MUST ask the browser not to remember their contents, and not to send them to a spell-checking service.
- **FR-038**: All clinical content in memory MUST be cleared at sign-out and on a `401`, except text being held on screen as the session-ending edge case describes, and no clinical content may appear on going back afterwards.
- **FR-039**: Signing in MUST NOT return anyone to a clinical address.
- **FR-040**: Stored text MUST be displayed exactly as written, safely, with no markup interpreted, so that text in a record can't run as code.
- **FR-041**: Confirmations, messages, and announcements to assistive technology MUST NOT repeat clinical text.

**Every state, every language**

- **FR-042**: Every screen MUST have loading, error, empty, and success states, MUST handle `401`, `403`, `404`, `422`, and `500`, and MUST NOT match on message text.
- **FR-043**: All text MUST exist in English and Arabic, every screen MUST work in both directions and both themes, and every action MUST work by keyboard, meeting WCAG 2.2 AA.
- **FR-044**: Tests MUST use synthetic data only.

**Privacy review**

- **FR-045**: Before acceptance, a written privacy review MUST cover: every place clinical text can reach (addresses, titles, logs, error reports, storage, caches, rendered output, the same-origin route, and browser features); who can reach each screen; the audit entries each journey writes, and that none is false; what happens on sign-out, session end, a shared computer, and an unattended screen; the risks this phase accepts; and what the legal review before production must still settle.
- **FR-046**: The review MUST rest on observed evidence, including the planted-text search against the running API, MUST name who did it, and MUST list each open risk for the owner to accept or reject. Anything it finds that breaks the constitution MUST be fixed before acceptance.

### Key Entities *(include if feature involves data)*

- **Visit**: A queue entry that is with the doctor or seen, with its date, times, walk-in flag, the patient's summary, and its record's status and number, if any. Holds no clinical content.
- **Medical record (encounter)**: The record of one visit, by one doctor, for one patient. Holds the clinical text, prescription lines, status (`draft` or `finalized`), addenda, and when it was started, last saved, and finalized.
- **Prescription line**: Medication, dosage, frequency, duration, and instructions, all free text.
- **Addendum**: A permanent correction on a finalized record, with its text and time. Its author is the record's author.
- **History item**: One finalized record's date and doctor, with no clinical content.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With a patient with them and no record yet, a doctor can be writing in that patient's record in one action from "My queue".
- **SC-002**: A doctor can find every visit lacking a finalized record, for any range the API allows, in at most two actions.
- **SC-003**: In a search after every journey, planted synthetic text appears in 0 addresses, 0 page titles, 0 browser storage entries, 0 lines of the server's output, and 0 audit entries.
- **SC-004**: Each role, on every clinical route and action, gets what the permission matrix says, on the running API: 100% of cells checked, and 0 reads made for a role refused by its gate.
- **SC-005**: Counted on the running API, each journey writes exactly the entries it should: 1 `encounter.opened` per person's opening, and 0 from hovering, focus, reconnecting, going away and back, a refresh elsewhere, polling "My queue", starting, saving, finalizing, or adding an addendum.
- **SC-006**: In 100% of tested refusals and failed saves, every character typed stays on screen.
- **SC-007**: After sign-out, going back shows 0 clinical content or patient detail, in both languages.
- **SC-008**: 100% of attempts to leave with unsaved text, by each route listed, give a warning before anything is lost, except where the browser itself controls the wording.
- **SC-009**: In 100% of tested finalizations, the record the API returns holds exactly the text on screen when the doctor confirmed, when only one tab was involved.
- **SC-010**: Accessibility checks find 0 serious or critical issues on every clinical screen, in both languages, directions, and themes, and each journey completes by keyboard alone.
- **SC-011**: The privacy review exists, every area in FR-045 has observed evidence, and the owner has accepted or rejected each open risk, before the phase is accepted.

## Assumptions

- **Permissions** are as verified in `docs/backend-integration.md`. Administrators and receptionists have no clinical access, by the backend's deliberate rule.
- **Starting a record needs no confirmation.** It's permanent, as records are never deleted, but an empty draft harms nothing and can be completed later. This is a reading of Principle VI like ADR 0012's on registering, and the owner accepted it on 2026-11-07.
- **"My visits" defaults to 30 days,** which is long enough to catch forgotten records and well inside the API's 92-day limit. The API's order is oldest first, so the most overdue appear first.
- **The fixed order means no sorting** (gap G4), and there's no patient filter in "My visits", because doctors have no way to search for a patient (the API refuses it).
- **The doctor's own number** comes from their profile, and decides only what the UI offers. The API decides what's allowed.
- **An identical save writes no audit entry,** from the source (`AuditTrail::recordChanges`), not yet exercised. `docs/backend-integration.md` H1 says every save writes one, which should be corrected once the live suite confirms it.
- **A refused read writes a permanent entry** only for `GET` of a record or a history that exists (`RecordRefusedOpening`), from the source. Refused saves, finalizing, and addenda don't.
- **The privacy review is done within this phase,** by whoever builds it, and is put to the owner. It doesn't replace the legal review of Egyptian health-data obligations, which stays a production requirement in the roadmap.
- **Backend:** no change is needed or requested. Saves having no version check is recorded as a gap.

## Out of scope

Attachments, lab or imaging orders, referrals, record templates, a drug catalogue, interaction or allergy checks; printing or exporting a record; patient access; deleting a record or draft; handing a record to another doctor; reassigning a draft; a patient filter or search for doctors; clinical content for administrators or receptionists; dashboards (Phase 12); audit screens (Phase 11); an inactivity sign-out, unless the owner decides otherwise in the privacy review; and any backend change.
