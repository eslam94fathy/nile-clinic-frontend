# Feature Specification: Audit Log

**Feature Branch**: `011-audit-log`

**Created**: 2026-11-10

**Status**: Draft

**Input**: User description: "Start Phase 11" of `docs/roadmap.md`: the audit log, for administrators only. One page to search the backend's audit trail, with filters for a clinic-date period, a staff member, a patient's number, a record (its type and number, together), an action (44 values), and an outcome (succeeded or refused). Results newest first, in pages with no total, moved through by next and previous, through a new shared `CursorPager`. Each search, and each page of it, writes a permanent `audit.searched` entry, so a search runs only when the person submits it, never while typing, and is never repeated, retried, or prefetched by itself ([ADR 0005](../../docs/decisions/0005-audit-safe-data-fetching.md), [ADR 0012](../../docs/decisions/0012-audited-reads-in-the-browser.md)). Each entry shows when it happened, in the clinic's time zone, the action, the outcome, who acted (their current name and the role they held then, or the system, or an unknown sign-in), the record acted on, the patient's number, the network address, the names of the fields changed with the before and after values the API keeps, and, for a search, the filters it used. Backend contract: `specs/011-audit-logs/contracts/audit.openapi.yaml` and `data-model.md`.

## Context

Since Phase 3, every sign-in, change, and opening of a patient's record or medical record has written a permanent entry to the backend's audit trail. Nobody can read it yet. An administrator who is asked "who changed this charge's discount?", "who opened this patient's record last week?", or "has anyone tried to sign in to this account and failed?" has no way to answer. The API answers these questions with one search; this phase shows it.

The trail is a legal record. Entries are only ever added, never changed or removed, and **reading the trail adds to it**: each page of a search writes an `audit.searched` entry naming the administrator and the filters they used. A search the person didn't ask for is false evidence about them, so how and when a search runs is the heart of this phase. Entries hold identifiers, field names, and a short allow-list of values (statuses, money, roles, appointment times, doctor assignments), never patient details, clinical content, reasons, passwords, or search text, as the backend guarantees.

## Clarifications

### Session 2026-11-10

- Q: Should filters survive a reload or the back button? → A: Filters are kept in the page's memory only, never in the address; a reload or a new tab starts empty, and going back from a linked page keeps them while the page is held.
- Q: Should opening the page show the newest entries straight away? → A: No. It opens with empty filters and no results, and Search with no filters shows the newest entries.
- Q: Should numbers in an entry link to their records? → A: Yes. A patient's number links through the audited link; staff account, doctor, appointment, and charge numbers link to their pages; other record types are text.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search the trail and read what happened (Priority: P1)

An administrator opens the audit log, optionally narrows it, and presses Search. They see the matching entries, newest first, and can read each one in full: when, what, by whom, on which record, for which patient, from where, and what changed.

**Why this priority**: This is the whole purpose of the phase. With no filters at all it already answers "what has happened recently?", and it is the smallest usable slice.

**Independent Test**: With synthetic activity (a sign-in, a patient registered, an appointment booked, a charge discounted), open the audit log, press Search with no filters, and confirm each entry appears newest first with every detail matching the API's values exactly, and that exactly one `audit.searched` entry was written for the search.

**Acceptance Scenarios**:

1. **Given** an administrator opens the audit log, **When** it appears, **Then** the filters are shown, empty, and no search has run; a neutral message invites them to search.
2. **Given** the person presses Search, **When** the results arrive, **Then** each entry shows its time in the clinic's time zone, including seconds, its action and outcome, translated, and who acted.
3. **Given** an entry by a staff member, **When** it is shown, **Then** it gives their name exactly as stored, which is their current name, and the role they held at the time, translated, labelled as the role at the time.
4. **Given** an entry by the system (the first administrator's set-up command) or an unknown sign-in (an email matching no account), **When** it is shown, **Then** it says so in words, with no name or role.
5. **Given** an entry with a record acted on, a patient, or a network address, **When** it is shown, **Then** the record's type (translated) and number, the patient's number, and the address appear; when one is absent, the entry says "none" rather than leaving a blank.
6. **Given** an entry with changes, **When** it is shown, **Then** it lists the names of the fields changed, translated where the frontend knows the field and as sent otherwise, and for each kept value its before and after, with a before of "none" on creation.
7. **Given** a kept value that is a status or a role, an amount of money, an appointment time, a yes-or-no, or a doctor's number, **When** it is shown, **Then** a status or role is translated, money is shown exactly as sent with its currency, a time is shown as a clock time, a yes-or-no in words, and a number as sent; any other value is shown exactly as sent.
8. **Given** a refused entry, such as a failed sign-in or a refused opening of a medical record, **When** it is shown, **Then** it is marked as refused with a text label, not color alone, and a failed sign-in's note says the staff member named is the account targeted, not necessarily the person who tried.
9. **Given** a search matching nothing, **When** it returns, **Then** an empty state says no entries match, keeping the filters.

---

### User Story 2 - Narrow the search (Priority: P1)

The administrator is investigating one question: one patient, one staff member, one charge, one kind of action, refusals only, or one stretch of days. They combine filters and search.

**Why this priority**: Without filters, a busy clinic's trail is too long to answer a specific question. Every investigation the Context names needs one.

**Independent Test**: With synthetic entries for two patients, two staff members, and several actions, search by each filter alone and in combination, and confirm only matching entries appear. Enter an end date before the start date, and a record number without a type, and confirm the person is told before anything is sent and no `audit.searched` entry is written.

**Acceptance Scenarios**:

1. **Given** the filters, **When** they are shown, **Then** the person can set a start date, an end date, a staff member, a patient's number, a record type with a record number, an action, and an outcome, all optional.
2. **Given** several filters are set, **When** the person searches, **Then** only entries matching all of them appear.
3. **Given** a staff member filter, **When** it is offered, **Then** it lists every staff account, including deactivated ones, as their entries remain; and the results include entries where that person acted and where their account was acted on, which the page states.
4. **Given** the action choice, **When** it is offered, **Then** it lists all 44 actions, translated and grouped by area (sign-in, staff, patients, specialties, doctors and schedules, appointments, visits, medical records, money, and the audit log itself).
5. **Given** an end date before the start date, a record number without a type or a type without a number, or a number that isn't a positive whole number, **When** the person presses Search, **Then** the matching field says so and nothing is sent. These checks are for faster feedback; the API's answer decides, and its message appears on the matching field if it refuses.
6. **Given** a patient's or staff member's number the API doesn't know, **When** the person searches, **Then** an empty result is shown, exactly as for no matches, since the API reveals nothing more.
7. **Given** the person changes a filter, **When** they haven't pressed Search, **Then** nothing is read, and the results shown are marked as belonging to the previous search until they do.
8. **Given** a "Clear" action, **When** it is used, **Then** every filter empties, without searching.

---

### User Story 3 - Move through the results (Priority: P1)

A search matches more entries than one page holds. The administrator moves to older entries and back to newer ones.

**Why this priority**: Any search over more than a day of activity spans pages. Without paging, User Stories 1 and 2 show only the newest page.

**Independent Test**: With more synthetic entries than one page holds, search, move forward twice and back once, and confirm each page's entries match the API's, that no entry repeats or is skipped, that new activity during paging doesn't shift the pages, and that each move wrote exactly one `audit.searched` entry and nothing else did.

**Acceptance Scenarios**:

1. **Given** results with older entries beyond this page, **When** they are shown, **Then** a "Older" action moves to the next page; with newer entries before it, a "Newer" action moves back. Each is unavailable when there is nothing in that direction.
2. **Given** paging, **When** it is shown, **Then** it shows no total, no page count, and no page numbers, as the API gives none, and says only whether the newest entries are shown ("Newest entries").
3. **Given** a move to another page, **When** it is pressed, **Then** the same filters apply, and the move is a person's action that the trail records, so it runs once per press and can't be pressed again while it runs.
4. **Given** new entries are written while the person is paging, **When** they move, **Then** the pages stay as they were; a new search starts from the newest.
5. **Given** a page position the API refuses, **When** it answers, **Then** the person is told the position is no longer valid and is offered to start the search again from the newest.

---

### User Story 4 - Look into a related record (Priority: P2)

From an entry, the administrator wants to see the patient, the staff account, or the record it concerns, to understand what happened.

**Why this priority**: It saves retyping numbers into other screens, but every investigation can be done without it.

**Independent Test**: From an entry naming a patient, follow the patient link and confirm one `patient.opened` entry is written by that click and none by viewing the audit log. From an entry naming a staff account, an appointment, or a charge, follow its link and confirm the right page opens. Confirm a medical record's number is not a link.

**Acceptance Scenarios**:

1. **Given** an entry with a patient's number, **When** the person follows it, **Then** the patient's record opens, and that opening is recorded by the trail as the person's own action; nothing is opened by hovering or by showing the results.
2. **Given** an entry whose record is a staff account, a doctor, an appointment, or a charge, **When** it is shown, **Then** its number links to that record's page; a record type with no page an administrator can open, such as a medical record, a visit, or time off, is shown as text.
3. **Given** a linked record that has since been removed, or that the person can no longer see, **When** they follow it, **Then** that page's own not-found or forbidden state appears.
4. **Given** the person returns from a linked page, **When** the audit log is shown again, **Then** the same results and page appear and no search runs.

---

### Edge Cases

- **Other roles.** Receptionists and doctors have no audit log in their navigation. If one reaches its address directly, the forbidden state appears and nothing is read; if the interface's view of their role is out of date, the API's refusal of the search shows the same state. The API decides, not the navigation.
- **Roles changing mid-session.** An administrator demoted while the page is open sees the forbidden state on the next search or page move, and the results shown are cleared.
- **Sign-in lapsing.** A lapsed or deactivated session on a search follows the app's sign-in flow. Returning after signing in doesn't run the search again, as the page writes an entry when read.
- **No search by itself.** Opening the page, focusing the window, reconnecting, going back to the page, changing language, a refresh triggered elsewhere, and the server answering slowly never run a search. A failed search is never retried by itself; the person can try again.
- **Double presses.** Pressing Search, Older, or Newer twice quickly runs one read.
- **A search lists itself afterwards.** The backend records a search after reading its results, so a search never lists itself, and the next one lists the previous search. The page says, near the results, that each search and page is recorded.
- **The person's own searches.** `audit.searched` entries show the filters used, as label and value pairs, translated, including staff and patient numbers as sent.
- **Removed records.** An entry's record may have been removed since; its number still shows, and its link (if any) shows that page's not-found state.
- **Names.** A staff member's name is their current one, and may differ from the name they had when they acted. The page states this once, near the results. Names are never translated.
- **Values and directions.** Numbers, money, addresses, and times stay left-to-right inside Arabic text. Before and after read in the reading direction.
- **Values the frontend doesn't know.** A field name or value with no translation, for example after a backend change, is shown exactly as sent rather than hidden or failing.
- **Clinic time.** Entry times are UTC instants shown in the clinic's time zone, never the computer's. Date filters are clinic dates.
- **Long periods.** A period has no maximum length; a search over years still returns one page at a time.
- **No patient details.** The trail holds patient numbers only. The page never looks up a patient's name to show beside a number, as that would read patient data for every entry shown.

## Requirements *(mandatory)*

### Functional Requirements

**Access**

- **FR-001**: The audit log MUST appear in the navigation of administrators only, through the one permissions map.
- **FR-002**: The page MUST handle the API's unauthenticated, forbidden, and validation answers, whatever the interface believed the role could do.

**When a search runs**

- **FR-003**: A search MUST run only when the person presses Search, Older, or Newer, or tries again after a failure, exactly once per press. It MUST NOT run on opening the page, typing, changing a filter, window focus, reconnecting, being shown again, changing language, a refresh triggered elsewhere, a timer, or a retry the person didn't ask for.
- **FR-004**: Results MUST be held in memory only, never in persistent browser storage or a shared cache, and MUST be gone after signing out.
- **FR-005**: While a search runs, its controls MUST show progress and MUST NOT start a second read.

**Filters**

- **FR-006**: The person MUST be able to filter by a clinic-date period, a staff member, a patient's number, a record type and number together, an action, and an outcome, each optional, combined with AND.
- **FR-007**: An end before the start, only one of record type and record number, and a number that isn't a positive whole number MUST be reported on the matching field before anything is sent. The API's validation messages MUST appear on the matching field, and any without one at form level.
- **FR-008**: The staff choice MUST include deactivated accounts. The action choice MUST list every action the API defines, translated and grouped.
- **FR-009**: Filters MUST NOT appear in the page's address, so that a reload, a link, or the back button can't repeat a search. They are kept in the page's memory only: a reload or a new tab starts empty.

**Results**

- **FR-010**: Results MUST be shown newest first, in the API's order, one page at a time, with Older and Newer moves and no total, page count, or page numbers.
- **FR-011**: Each entry MUST show every item in User Story 1: time, action, outcome, who acted and their role at the time, record type and number, patient's number, network address, changed fields with their kept values, and, for a search, its filters.
- **FR-012**: Actions, outcomes, record types, roles, statuses, and known field names MUST be shown translated; any identifier without a translation MUST be shown as sent. Names MUST be shown as stored.
- **FR-013**: Money MUST stay a string from the API to the screen, shown exactly as sent with its currency. Entry times MUST be shown in the clinic's time zone.
- **FR-014**: A refused outcome MUST be distinguishable by text, not color alone.
- **FR-015**: The page MUST state, near the results, that each search and each page is recorded in the trail, and that staff names are current names.

**Links**

- **FR-016**: A patient's number MUST link to their record through the app's audited link, which records an opening only when clicked and is never prefetched. Staff account, doctor, appointment, and charge numbers MUST link to their pages. Other record types MUST be shown as text.
- **FR-017**: Returning to the audit log from a linked page MUST show the same results and page without searching again, while the page is kept.

**States**

- **FR-018**: The page MUST have its before-search, loading, error, empty, and success states. A failed search MUST say so and offer trying again by the person's action; a failed page move MUST keep the page already shown, marked as not updated.
- **FR-019**: A refused page position MUST say so and offer a new search from the newest.
- **FR-020**: All user-facing text MUST exist in English and Arabic, and the page MUST work in both directions and both themes.

**Shared paging**

- **FR-021**: Paging with no total MUST be a shared component, `CursorPager`, offering Older and Newer with progress and disabled states, as the blueprint plans. It has one consumer in this phase.

### Key Entities *(include if feature involves data)*

- **Audit entry**: One thing that happened: its number, when, the action, the outcome, the actor, the record acted on (type and number, or none), the patient's number (or none), the network address (or none), the changes (or none), and, for a search, its filters (or none).
- **Actor**: Staff (with number, current name, and role at the time), the system, or unknown.
- **Changes**: The names of the fields changed, and before and after values for the allow-listed fields only.
- **Search**: The filters, and a position in its results; each page read is itself an audit entry.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator can find who last changed a given charge's discount, starting from the charge's number, in under 30 seconds of work.
- **SC-002**: In automated tests against the running API, each Search, Older, and Newer press writes exactly one `audit.searched` entry, and opening the page, focusing, going back, changing language, and a refresh elsewhere write none.
- **SC-003**: 100% of entry details on screen match the API's values exactly in automated tests, including money, times in the clinic's time zone, refused outcomes, system and unknown actors, and values without a translation.
- **SC-004**: Automated tests confirm administrators can search and receptionists and doctors are refused, in both languages.
- **SC-005**: The page has before-search, loading, error, empty, and success states in both languages, both directions, and both themes, with no hard-coded user-facing text and no accessibility violations in automated checks.
- **SC-006**: In automated tests, no filter value, patient number, or result appears in the address, in persistent browser storage, or in the application server's log.

## Assumptions

- The backend's Audit module (`specs/011-audit-logs`) is final, and its contract is the source of every field, filter, and refusal used here. Its search is not rate limited.
- The page opens without searching, and the person searches with no filters to see the newest entries (clarified 2026-11-10).
- Filters stay in the page's memory only, not in the address (FR-009, clarified 2026-11-10), following ADR 0012's handling of patient search.
- A page holds 25 entries, a fixed size within the API's limit of 100.
- The staff choice is filled from the staff list Phase 4 already reads, which is not audited.
- Field names are translated for the fields the backend's allow-list and models name; others show as sent. Appointment times arrive as minutes after midnight and are shown as clock times.
- Doctors in changes (`doctor_id`) are shown by number, not name, to avoid reading more for every entry.
- Exporting, printing, and saving searches are out of scope, as the API offers none and decision Q5 excludes printing.
- Whether network addresses are personal data, and how long entries are kept, are for the legal review before production (roadmap). Until the backend trusts the proxy, network addresses show the application server's address (hazard H2); the page shows what the API sends.
