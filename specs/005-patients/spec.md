# Feature Specification: Patients

**Feature Branch**: `005-patients`

**Created**: 2026-11-06

**Status**: Accepted

**Input**: User description: "Start Phase 5" of `docs/roadmap.md`: patients. Search with Arabic-aware API matching, register, view, edit. Audited reads apply. Administrators and receptionists only; doctors have no access to patient management.

## Clarifications

### Session 2026-11-06

- Q: What should the patient list show before anyone searches, given that the API can list every patient and reception screens are shared? → A: Search first. The page opens with the search fields and a prompt, and no patient appears until someone searches.
- Q: After registering, should the person see the record the API returned, or go to the normal patient page, which reads the record and writes a `patient.opened` entry beside `patient.registered`? → A: Show the returned record, with no further read. Reloading the page later is a person's action and records a true opening.
- Q: The API blocks only a repeated national ID, and duplicates can't be merged later. What should happen when someone registers a patient? → A: Before saving, search for the phone number entered. If patients match, show them with a link to open each and a way to register anyway. It warns and never blocks, because phones can be shared.
- Q: How should reception enter a search, given that a typed number can't be reliably told apart as a phone or a patient number? → A: Four labelled fields, one per API filter, all visible. The application never guesses the type.
- Q: Should registering ask for confirmation, given that the constitution requires it for irreversible actions, and patients can't be deleted? → A: No. A wrong detail can be corrected by editing, so registering isn't treated as irreversible, which is also how Phase 4 treated creating staff accounts and specialties. The real safeguard against a duplicate is the phone check. A confirmation on every registration would slow the desk. The reasoning is recorded in ADR 0012.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find a returning patient (Priority: P1)

A patient arrives and gives their name, phone number, patient number, or national ID. Reception searches, sees a short list showing only what's needed to pick the right person, and opens the right record.

**Why this priority**: Returning patients are the daily norm, and every later phase (booking, queue, billing) starts by finding a patient. Finding someone reliably is also what prevents duplicate records.

**Independent Test**: With synthetic patients in Arabic and English, search by part of a name using different Arabic spellings, then by phone, patient number, and national ID, and confirm the expected patient appears each time. Confirm that the page's address never held what was searched for.

**Acceptance Scenarios**:

1. **Given** a patient named with `أ`, **When** a person searches with `ا`, **Then** the API's matching finds them, and the application adds no matching of its own.
2. **Given** a phone number typed with spaces, dashes, or digits in Arabic form, **When** searching by phone, **Then** the patients with that number appear, including several who share it.
3. **Given** a search, **When** results appear, **Then** each row shows only patient number, full name, sex, date of birth, and phone, and leads to that patient's page.
4. **Given** a search with no matches, **When** it finishes, **Then** an empty state says so, keeps what was typed, and offers to register a new patient.
5. **Given** a malformed national ID, phone, or patient number, **When** searching, **Then** the API's message appears on that field.
6. **Given** more matches than fit on a page, **When** paging, **Then** the API's totals are used and the search terms stay in place.
7. **Given** any search, **When** it runs, **Then** the terms appear nowhere in the page's address, browser history, logs, or browser storage.
8. **Given** a person opened a patient from the results, **When** they go back, **Then** their search and results are still there, with no new opening recorded.
9. **Given** the patient list is opened, **When** nobody has searched yet, **Then** the search fields and a prompt appear, no patient is shown, and no list is requested.
10. **Given** every search field is empty, **When** the search is submitted, **Then** the screen asks for at least one term, and no list is requested.

---

### User Story 2 - Register a new patient (Priority: P1)

A patient comes for the first time. Reception enters their full name, date of birth, sex, and phone, plus any optional details they have: national ID, address, and an emergency contact. The patient receives a patient number that identifies them from then on.

**Why this priority**: Nobody can be booked, queued, seen, or billed until they exist.

**Independent Test**: Register a synthetic patient with required details only, and another with every detail, then confirm the patient numbers and the stored values. Provoke each refusal the API can give and confirm where it appears.

**Acceptance Scenarios**:

1. **Given** valid required details and no other patient with that phone, **When** the form is submitted, **Then** the patient is registered, a confirmation shows the new patient number, the record is shown as the API returned it, and the audit trail gains `patient.registered` with no `patient.opened`.
2. **Given** a national ID already recorded for another patient, **When** submitting, **Then** the API's message appears on the national ID field, nothing is created, and what was typed is kept.
3. **Given** a date of birth in the future or more than 130 years ago, or a malformed phone or national ID, **When** entering, **Then** quick feedback appears, and the API's answer still decides.
4. **Given** one part of an emergency contact is filled in, **When** submitting, **Then** the missing parts are identified on their own fields.
5. **Given** a form with no national ID, address, or emergency contact, **When** it is saved, **Then** the record shows those as not recorded, not as blank or zero.
6. **Given** registration succeeded, **When** the person later returns to the form, **Then** it is empty.
7. **Given** other patients already have the phone entered, **When** submitting, **Then** nothing is created yet, and those patients are shown using list fields only, each with a link to open it and a way to register anyway.
8. **Given** the possible matches are shown, **When** the person chooses to register anyway, **Then** the patient is registered with what was typed, with no second check.
9. **Given** the possible matches are shown, **When** the person opens one, and then returns, **Then** what they typed is still in the form, and only that one opening was recorded.
10. **Given** the duplicate check can't be completed, **When** submitting, **Then** the screen says the check didn't run, and the person can still register or try again.
11. **Given** the record is shown after registering, **When** the person reloads the page, **Then** the record is read once and an opening is recorded, which is true, and nothing is registered twice.

---

### User Story 3 - View a patient's full record (Priority: P1)

Staff open one patient and see everything recorded: patient number, identity, contact details, national ID, address, emergency contact, and when the record was registered and last changed. Each opening is recorded permanently in the audit trail, so the application opens a record only because a person asked for it, and exactly once for each time they asked.

**Why this priority**: Every other patient action leads through this page, and it's the first audited read the application makes. A false entry in the audit trail is false evidence.

**Independent Test**: As an administrator, count the backend's `patient.opened` entries for a synthetic patient around each of these: opening from results, hovering over its link, leaving the tab and returning, going back to the page, and choosing "Reload details". Only the opening and "Reload details" add an entry.

**Acceptance Scenarios**:

1. **Given** a results list, **When** it is shown, hovered over, or focused, **Then** no patient is opened and no entry is written.
2. **Given** a person opens a patient, **When** the page appears, **Then** exactly one entry was written.
3. **Given** an open patient page, **When** the tab regains focus, the network reconnects, or another page changes data, **Then** no request is made for the record and no entry is written.
4. **Given** a person left a patient page, **When** they return with the back button and the page is still held, **Then** it appears without a new opening, including after a change on another page.
5. **Given** a record already opened and still held, **When** the person opens it again through a link, **Then** it is read again and one more entry is written, because they asked for it.
6. **Given** a patient page, **When** the person chooses to reload the details, **Then** the record is read once, and one more entry is written, which is true.
7. **Given** a patient number that doesn't exist, or an address that isn't a valid number, **When** it is opened, **Then** the neutral not-found state appears.
8. **Given** the record couldn't be read, **When** the error appears, **Then** nothing retries automatically, and the person can choose to try again.
9. **Given** optional details weren't recorded, **When** the page is shown, **Then** each says "not recorded".
10. **Given** a stored name in either language, **When** the page is shown, **Then** it appears as written, in its own direction, and the browser's tab title doesn't contain it.

---

### User Story 4 - Correct a patient's details (Priority: P2)

A patient's phone, address, or emergency contact changes, or a mistake was made at registration. Staff edit the record directly on its page and can clear any optional detail. The patient number never changes.

**Why this priority**: Records drift and mistakes happen, but the clinic can begin operating with search and registration alone.

**Independent Test**: Change a synthetic patient's phone and clear their address, then confirm the new values and the patient number through the API. Confirm through the audit trail that the change wrote `patient.updated`, and that neither starting the edit nor saving it wrote a further `patient.opened`.

**Acceptance Scenarios**:

1. **Given** an open patient page, **When** the person starts editing, **Then** the form is filled from the record already on screen, and no new read happens.
2. **Given** a valid change, **When** it is saved, **Then** only the changed fields are sent, the page shows the record the API returned, a confirmation appears, and no further read happens.
3. **Given** nothing was changed, **When** saving, **Then** no request is sent and the form says there was nothing to save, because a no-change save would otherwise write a false opening.
4. **Given** an optional detail with a value, **When** it is emptied and saved, **Then** it's cleared and then shows as "not recorded". Emptying all three parts of an emergency contact clears the contact.
5. **Given** a required detail, **When** it is emptied, **Then** quick feedback appears, and the API's answer still decides.
6. **Given** a national ID held by another patient, or another refused value, **When** saving, **Then** the API's message appears on that field, nothing changes, and what was typed is kept.
7. **Given** editing is under way, **When** the person cancels, **Then** the record returns as it was, with no read.
8. **Given** a saved change, **When** the person returns to search results that showed this patient, **Then** the results show the new values without a manual reload.

---

### User Story 5 - Roles and refusals (Priority: P1)

Administrators and receptionists have the same patient access. Doctors have none in this phase: no navigation entry and no page content. A role changed during a session is handled by whatever the API answers.

**Why this priority**: Doctors must see only clinical views of patients, through later phases, and never phone, national ID, address, or emergency contact.

**Independent Test**: Sign in as each role and compare every patient page and action against the verified permission matrix, then force a refused action and confirm what appears.

**Acceptance Scenarios**:

1. **Given** a doctor, **When** they look at their navigation, **Then** no patient entry appears.
2. **Given** a doctor, **When** they open any patient address, **Then** the "not allowed" state appears, no patient content is sent, and no read of the record is attempted.
3. **Given** a role changed mid-session, **When** the API answers `403` to a search, opening, or save, **Then** the "not allowed" state or message appears, whatever the screen believed, and any patient details already on screen are removed.
4. **Given** the session ends, **When** the person signs in again, **Then** they aren't returned to a patient's page, and the record isn't opened on their behalf.
5. **Given** a person signs out, **When** anyone uses that computer next, **Then** no patient details, search terms, or results remain, whether on screen, in hidden pages, or in browser storage.

---

### Edge Cases

- Several patients share a phone number, such as a parent and children: all appear, and the phone alone never identifies one person.
- Two patients have the same name and date of birth: this is allowed. The patient number is what tells them apart, so it's always shown.
- A child or foreign patient has no national ID: the record is valid, and a foreign patient's passport isn't captured, as the API has no field for one.
- Digits typed in Arabic form in phone, national ID, or patient number fields are converted before sending, as fees already do. A native date field already gives Western digits. A name is never altered.
- A date of birth near midnight, or on a computer in another time zone: quick feedback uses the clinic's today, the API decides, and the date is displayed as sent, with no time-zone shift.
- Two people edit one patient: the API has no way to detect this, so the last save wins for each field sent. Only changed fields are sent, which limits what one person can overwrite, and "last changed" helps people notice.
- An audit entry can't be saved: the API answers `500`, and the record is not returned or the change did not happen. A general error appears, and the application doesn't claim otherwise.
- An extremely long name, or a very long address: it wraps without breaking the page.
- A very short name search, such as one letter: results stay paged, because the API bounds them.
- The address of a patient page is opened in a new tab, or reloaded: this is a person's action, so it reads the record and truthfully records an opening.
- The language is switched on a patient page: the page is opened afresh in the other language, so it reads the record and truthfully records an opening. On the list page, the search starts again.
- The page was no longer held when someone goes back to it, because many pages were visited in between: it reads the record again and truthfully records an opening, since the person asked to see it.
- The phone is changed after possible matches appear: the matches no longer apply, so submitting checks the new phone.
- The framework's development checks can repeat effects, which could write an extra entry in the development audit trail: this must be identified as such, not mistaken for a production fault, and not hidden. Automated checks of the opening count run against a production build.
- The phone entered for registering is malformed: the duplicate check is skipped, as it couldn't match anyone, and the API's message appears on the phone field.
- Several family members share a phone: the possible matches list all of them, and registering anyway is the normal path for a new child, so the wording doesn't imply a mistake.
- The session ends during a form: the usual sign-in redirect applies, and what was typed isn't kept in browser storage.

## Requirements *(mandatory)*

### Functional Requirements

**Search and list**

- **FR-001**: Administrators and receptionists MUST be able to search patients by part of the name, by phone, by patient number, and by national ID. Terms MUST be sent to the API without the application adding its own matching, including for Arabic letter variants.
- **FR-002**: The screen MUST state which searches match a part and which need the whole value: name matches a part, and the others match exactly. Filled-in terms combine, as the API defines.
- **FR-003**: The list page MUST open with four labelled search fields and a prompt, and MUST NOT show or request any patient until a search with at least one term is submitted. It MUST NOT offer a way to list every patient.
- **FR-004**: Search terms MUST NOT be placed in the page's address, browser history, page title, logs, analytics, error reports, or browser storage. A search MUST run only when submitted, not while typing.
- **FR-005**: Results MUST show only the API's list fields, and page using the API's totals in the order the API returns. No sort control MUST be offered (backend gap G4).
- **FR-006**: Links to patient pages MUST NOT fetch or prepare the record ahead of the person's action, whether on hover, on focus, or on being shown.
- **FR-007**: Going back from a patient to the results MUST restore the search and results while they're still held. If they've been discarded, for example after a reload, the screen MUST simply start again, because the terms were deliberately never kept in the address.

**Register**

- **FR-008**: Administrators and receptionists MUST be able to register a patient with full name, date of birth, sex, and phone, and optionally national ID, address, and emergency contact.
- **FR-009**: Sex MUST have no preselected value.
- **FR-010**: Quick feedback MUST cover required fields, a date of birth between 130 years ago and the clinic's today, a phone of 8 to 15 digits with an optional `+` after separators are ignored, a national ID of 14 digits starting with 2 or 3, the API's length limits, and an emergency contact needing all three parts. The API's answer MUST win.
- **FR-011**: After registering, the application MUST show the record the API returned, with the new patient number, and MUST NOT read the record again. From there, the person MUST be able to edit it as on the patient's page. Reloading MUST read it once and MUST NOT register anything again.
- **FR-012**: Before registering, a well-formed phone MUST be checked by searching for it. Patients who match MUST be shown using list fields only, each with a link to open it, along with a way to register anyway. The check MUST warn and MUST NOT block. Registering anyway MUST NOT repeat the check. If the check fails, the person MUST be told, and MUST be able to register or try again. Editing a patient MUST NOT run this check.

**View**

- **FR-013**: Administrators and receptionists MUST be able to open a patient and see every field the API returns, with absent optional details stated as "not recorded".
- **FR-014**: A record MUST be read only as the direct result of a person's action, and once for each such action. Following a link to it, loading its address, and choosing to reload it are such actions. Window focus, reconnecting, re-rendering, a refresh caused by a change elsewhere, a retry after failure without the person asking, and being shown again from a held state MUST NOT read it.
- **FR-015**: The page MUST offer an explicit action to reload the details, and MUST say that this records another opening.
- **FR-016**: Patient details MUST NOT appear in the browser's tab title, or in any address other than the patient number.

**Edit**

- **FR-017**: Administrators and receptionists MUST be able to edit every detail except the patient number, on the patient's page, from the record already on screen, with no further read.
- **FR-018**: A save MUST send only what changed, and MUST send nothing when nothing changed. An emptied optional detail MUST be sent as cleared. An emergency contact MUST be sent whole when any part changed, and cleared when all three parts are empty.
- **FR-019**: After a save, the page MUST show the record the API returned and MUST NOT read it again.
- **FR-020**: A save MUST NOT cause any held search results to show old values when returned to, and MUST NOT cause any other held patient page to read its record.

**Access**

- **FR-021**: This phase's real pages MUST replace the "not available yet" placeholder for Patients. Later phases' placeholders MUST stay as they are.
- **FR-022**: Page access and controls MUST follow the single role map. The API's `401`, `403`, and `404` MUST be handled on every screen and action, whatever the map says.
- **FR-023**: A person's return after sign-in MUST NOT lead to a patient's page, and MUST NOT carry search terms.
- **FR-024**: Signing out MUST leave no patient details, search terms, or results in hidden pages, memory, or browser storage.

**Cross-cutting**

- **FR-025**: Every view MUST provide loading, error, empty, and success states, using the shared design system, with all text in both languages and working in both directions.
- **FR-026**: Every change MUST show progress, prevent double submission, show the API's message on the matching field, including each emergency contact part, or otherwise at form level, and confirm success.
- **FR-027**: Sex MUST be translated by the application. Stored text MUST appear as written, never translated, and in its own direction.
- **FR-028**: Dates of birth MUST be shown as sent. "Registered" and "last changed" MUST be shown in the clinic's time zone.
- **FR-029**: Patient search and form fields MUST ask the browser not to remember or suggest what was typed, because reception computers are shared.
- **FR-030**: Patient details and search terms MUST NOT be written to logs, analytics, or error reports, and tests MUST use synthetic data only.
- **FR-031**: Digits typed in Arabic form MUST be converted to Western digits in phone, national ID, and patient number fields before quick feedback and sending. Names and addresses MUST NOT be altered.
- **FR-032**: No appointment, encounter, or billing information MUST be shown on patient pages in this phase. Phase 6's [FR-024](../006-appointments/spec.md) adds two links to appointments, and still no appointment information.

### Key Entities

- **Patient summary**: What a list or search shows: patient number, full name, sex, date of birth, and phone. Reading it isn't audited.
- **Patient record**: The summary plus national ID, address, emergency contact, and registered and last-changed times. Each read is recorded permanently. Never deleted.
- **Patient number**: The API's permanent identifier. It can't be chosen or changed, and it's the only patient detail allowed in an address.
- **Emergency contact**: A person to reach on the patient's behalf: name, relationship, and phone, all three or none.
- **Opening**: The permanent audit entry that says a person read a record. It's a legal record, so the application must never cause a false one.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A receptionist can register a new patient with the required details in under 1 minute, using only the application.
- **SC-002**: Reception can find a known patient and open their record in under 30 seconds, by each of the four search types, in both languages.
- **SC-003**: Across a scripted journey against the real API, the number of opening entries equals exactly the number of openings a person asked for, in 100% of runs, with hovering, tab focus, going back to a held page, a change on another page, editing, and saving adding none.
- **SC-004**: Arabic name searches find the patient regardless of alef, taa marbuta, and yaa spelling, in 100% of tested cases, with the matching done entirely by the API.
- **SC-005**: A search of the address history, browser storage, and application logs after a full journey finds no synthetic search term or patient detail, other than patient numbers in addresses.
- **SC-006**: For each role, 100% of patient pages and controls agree with the verified permission matrix, by automated comparison, and a forced action refused by the API shows a clear state.
- **SC-007**: Every refusal the API can give on these forms appears on the correct field or at form level, with zero dropped, in both languages.
- **SC-008**: Every screen shows correct loading, error, empty, and success states, in both languages and directions.
- **SC-009**: Automated accessibility checks report no WCAG 2.2 AA violations on the new screens in either language or direction, and registering, finding, and editing can each be finished by keyboard alone.
- **SC-010**: Every patient operation is exercised against the running API, with its fields and statuses confirmed to match the contract.
- **SC-011**: Every quality check passes, and results recorded for this phase are ones actually observed.

## Assumptions

- Search terms are patient details, and the constitution forbids them in page addresses, so they aren't kept across a reload. This is a deliberate exception to the design-system rule that filters survive a reload. It's the price of that privacy rule, and going back from a patient still restores the search while it's held.
- The duplicate check uses the phone only. A national ID is already refused by the API when repeated, and a name match would produce too many false warnings to be useful at the desk.
- Administrators see the same patient screens as receptionists, as the API draws no distinction between them.
- Editing on the patient's page, rather than on a separate address, avoids recording a second opening merely to change a phone number.
- Patient pages stay held in a hidden state after leaving, as visited pages do, until sign-out clears them. What's typed but unsaved in a register or edit form also stays until then, which lets someone look something up and return. It's not written to browser storage.
- The API has no search for a passport or other foreign document, and no merge, archive, or delete. None are offered.
- Age isn't calculated or displayed. The date of birth is shown as sent.
- Live end-to-end tests run against the Docker backend, with synthetic patients. The audit trail is read through the API by a test administrator, because the audit screen arrives in Phase 11.

### Out of scope

Appointments, queue actions, charges, and any clinical content on patient pages; doctors' patient views, which arrive with medical encounters in Phase 8; the audit log screen; merging, archiving, or deleting patients; partial phone or national ID search; masking of sensitive fields; printing; warnings about unsaved changes when leaving a form; and any backend change.
