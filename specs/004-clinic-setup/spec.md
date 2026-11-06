# Feature Specification: Clinic Setup

**Feature Branch**: `004-clinic-setup`

**Created**: 2026-11-06

**Status**: Draft

**Input**: User description: "Start Phase 4" of `docs/roadmap.md`: clinic setup, meaning staff, specialties, doctors, schedules, and fees. Everything that must exist before booking. Done when an administrator can take a new doctor from account to bookable, with a fee.

## Clarifications

### Session 2026-11-06

- Q: How should an administrator be guided through setting up a new doctor: ordinary linked screens, or a dedicated step-by-step wizard? → A: Ordinary screens that link to each other. Each step offers the next, and the doctor's page shows a readiness summary of what's still missing.
- Q: Should a doctor with slots but no fee count as ready, given that the API lets reception book them but refuses to charge the visit? → A: Show two separate facts. "Bookable" means the API offers slots, and "setup complete" also needs a fee. A doctor with slots but no fee shows as bookable, with a warning that visits can't be charged until a fee is set.
- Q: Should the doctor's read-only "My schedule" screen be built in this phase, even though the roadmap's Phase 4 description only talks about the administrator's setup work? → A: Yes. It is built in Phase 4 as the lowest-priority story: the doctor's own hours, upcoming slots, and time off, read-only.
- Q: When an administrator changes a doctor's hours or records time off, should the application say how many existing appointments are now affected, or only state in general that some may be? → A: General statement only. Existing appointments aren't moved or cancelled, and reception will see affected ones flagged. The actual list arrives with appointments in Phase 6.
- Q: What should happen when an administrator opens their own staff account, given that the API lets them deactivate themselves, demote themselves, or reset their own password unless they're the last active administrator? → A: Allow deactivating and demoting yourself, with a confirmation saying you'll lose access. For your own password, replace the reset with a link to your account page.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Take a new doctor from account to bookable (Priority: P1)

A new doctor joins the clinic. An administrator creates their staff account, creates their doctor profile with at least one specialty, sets their weekly hours, and sets their fee. At each step the application offers the next one, and the doctor's page shows plainly what is still missing and when the doctor is ready. Booking screens arrive in a later phase, so "bookable" is proven by the slots the API now offers for this doctor.

**Why this priority**: This is the phase's named completion condition. Reception cannot book anyone until it works.

**Independent Test**: As an administrator, starting with no record of the person, complete all the steps using only the application, and confirm that the doctor's page shows upcoming slots and the fee.

**Acceptance Scenarios**:

1. **Given** a new account created with the doctor role, **When** it is saved, **Then** the administrator is offered "create doctor profile" for exactly that account, without searching for it.
2. **Given** a new doctor profile, **When** it is saved, **Then** the administrator arrives at that doctor's page, which identifies working hours and fee as still missing.
3. **Given** a doctor with an active account, working hours, and a fee, **When** the page shows them, **Then** every readiness item is complete, the page says setup is complete, and upcoming slots from the API are listed.
4. **Given** a doctor with working hours but no slots in the coming 31 days, **When** the page is shown, **Then** the slots item is incomplete, and the page does not claim the doctor is bookable.
5. **Given** a doctor with slots but no fee, **When** the page is shown, **Then** it says the doctor is bookable, does not say setup is complete, and warns that visits can't be charged until a fee is set.
6. **Given** the finished setup, **When** the doctor signs in, **Then** the "profile not set up" state no longer appears.

---

### User Story 2 - Manage staff accounts (Priority: P1)

An administrator sees all staff accounts, narrows them by role and status, creates accounts, corrects names, emails, and roles, deactivates and reactivates accounts, and sets a new password for someone who has lost theirs.

**Why this priority**: Every doctor starts as a staff account. It is also the clinic's only way to add staff and to recover a lost password.

**Independent Test**: With synthetic accounts, perform each action in both languages and confirm the effect through the API, including the end of the affected person's session.

**Acceptance Scenarios**:

1. **Given** the staff list, **When** a role or status filter is applied, **Then** only matching accounts appear, in the API's order, and the filter and page survive a reload and the back button.
2. **Given** valid details, **When** an account is created, **Then** it is active and the administrator arrives at its page with a confirmation.
3. **Given** an email already in use or a password outside 12–72 characters, **When** the form is submitted, **Then** the API's message appears on that field, and what was typed apart from the passwords is kept.
4. **Given** an active account, **When** the administrator deactivates it after confirming, **Then** it shows as deactivated and that person's sessions have ended. Reactivating restores sign-in, and the old sessions stay ended.
5. **Given** an account, **When** the administrator sets a new password after confirming, **Then** a confirmation says that person's sessions were ended, and the fields are cleared.
6. **Given** the last active administrator, **When** deactivating or demoting them is attempted, **Then** the API's refusal is shown and the account is unchanged.
7. **Given** the administrator is deactivating or demoting their own account, **When** they confirm, **Then** the confirmation has already said they will lose access, and after success they follow the normal rules for an ended session or changed role.
8. **Given** the administrator opens their own account's page, **When** it is shown, **Then** no password reset is offered, and a link leads to their account page, where changing their password keeps them signed in.

---

### User Story 3 - Maintain the specialty catalog (Priority: P1)

An administrator sees every specialty with its English and Arabic names, adds new ones, renames them, and deactivates or reactivates them. Nothing is ever deleted.

**Why this priority**: A doctor profile cannot be created without at least one active specialty.

**Independent Test**: Add, rename, deactivate, and reactivate a synthetic specialty, and confirm how each state affects the doctor form.

**Acceptance Scenarios**:

1. **Given** the catalog, **When** it is opened in either language, **Then** both names appear as stored, and active and deactivated specialties can be told apart without relying on color.
2. **Given** a name already used by another specialty, **When** it is saved, **Then** the API's message appears on that name field.
3. **Given** a specialty, **When** it is deactivated after confirming, **Then** the confirmation has explained that assigned doctors keep it and that it can't be newly assigned.
4. **Given** an empty catalog, **When** it is opened, **Then** an empty state offers to add the first specialty.

---

### User Story 4 - Maintain doctor profiles (Priority: P1)

An administrator browses and finds doctors by name, specialty, and status, creates a profile for a doctor-role account, and edits a profile's title, registration number, and specialties.

**Why this priority**: The profile is what makes a doctor exist for scheduling, booking, and charging.

**Independent Test**: Create and edit a synthetic doctor, including each refusal the API can give, in both languages.

**Acceptance Scenarios**:

1. **Given** the doctor list, **When** a name is searched in Arabic or English, **Then** the API's matching decides the results, and the filters survive a reload and the back button.
2. **Given** the create form, **When** choosing the account, **Then** active doctor-role accounts are offered, and a note explains that accounts which already have a profile can't be identified in advance.
3. **Given** an account that already has a profile, **When** the form is submitted, **Then** the API's refusal appears on the account field.
4. **Given** no active specialties, **When** the create form is opened, **Then** it says a specialty is needed first and links to the catalog.
5. **Given** the specialty choices, **When** creating a doctor, **Then** only active specialties are offered. **When** editing, **Then** a deactivated specialty already assigned stays shown and may be kept.
6. **Given** a registration number already taken, or an invalid one, **When** saving, **Then** the API's message appears on that field. **When** the number is cleared and saved, **Then** the profile has none.
7. **Given** an account deactivated or moved away from the doctor role, **When** that doctor is viewed, **Then** they show as inactive, and the page explains that no slots are offered while this is so.

---

### User Story 5 - Set a doctor's weekly hours (Priority: P1)

An administrator sets a doctor's appointment length and working periods for each day of the week, with breaks expressed as gaps between periods, and saves the whole week at once. They can also clear the schedule entirely.

**Why this priority**: Slots come from the schedule, so a doctor without one can't be booked.

**Independent Test**: Save a schedule with split days, confirm the resulting slots from the API, then provoke each refusal and confirm it appears against the right period.

**Acceptance Scenarios**:

1. **Given** a doctor with no schedule, **When** the schedule area is opened, **Then** an empty state offers to set one, with all seven days shown from Sunday to Saturday.
2. **Given** a valid week, **When** it is saved, **Then** a confirmation appears and the saved schedule and its slots are shown as the API returned them.
3. **Given** a period the API refuses, **When** saving, **Then** the message appears against that exact period, nothing is changed, and all entries are kept for correction.
4. **Given** a day with 4 periods, or a time not on a 5-minute boundary, **When** entering, **Then** quick feedback appears, and the API's answer still decides.
5. **Given** a period ending at the end of the day, **When** it is entered and later shown, **Then** it appears as `24:00`.
6. **Given** a saved schedule, **When** the administrator clears it after confirming, **Then** the confirmation has explained that the doctor will offer no slots, and the empty state appears.
7. **Given** any schedule change, **When** saving or clearing, **Then** the application has said that existing appointments are not moved or cancelled, and that reception will see any affected ones flagged.

---

### User Story 6 - Set and review fees (Priority: P1)

An administrator sets or changes a doctor's fee from the doctor's page, and anyone allowed can review all fees in one list, including who set each one and when.

**Why this priority**: It is part of the phase's completion condition, and a visit can't be charged until its doctor has a fee.

**Independent Test**: Set and change a synthetic doctor's fee, then confirm the amount, setter, and time, both on the doctor's page and in the list.

**Acceptance Scenarios**:

1. **Given** a doctor with no fee, **When** the fee area or list is shown, **Then** it says clearly that no fee is set, and doesn't show zero.
2. **Given** a valid amount, **When** it is saved, **Then** the API's formatted amount, setter, and time appear with a confirmation, and the application has said that existing charges keep their amount.
3. **Given** an amount of zero or less, above the maximum, or with more than two decimals, **When** entering, **Then** quick feedback appears, and the API's answer still decides.
4. **Given** any amount, **When** it is entered, stored, or displayed, **Then** it is exactly preserved, with no rounding from floating-point arithmetic.
5. **Given** the fee list, **When** more doctors exist than fit on a page, **Then** it pages using the API's totals, and the page survives a reload.

---

### User Story 7 - Record and remove time off (Priority: P2)

An administrator records a doctor's whole days or part of one day away, with an optional reason, and removes entries that haven't ended. The form warns that every staff member can read the reason, so it must hold no medical or personal details.

**Why this priority**: Hours are normally stable, and booking works without time off, but it prevents bookings on days the doctor is away.

**Independent Test**: Record whole-day and part-day entries, confirm that the slots disappear, remove one, and confirm that they return.

**Acceptance Scenarios**:

1. **Given** the time-off area, **When** it is opened, **Then** entries from the clinic's today for the next 366 days appear, and another range of up to 366 days can be chosen.
2. **Given** a part-day entry across different dates, or a date before the clinic's today, **When** saving, **Then** the API's message appears on the relevant field.
3. **Given** the reason field, **When** it is shown, **Then** the "no medical details" hint is visible with it.
4. **Given** an entry that hasn't ended, **When** it is removed after confirming, **Then** it disappears and the slots are refreshed.
5. **Given** an entry that ended earlier today, **When** removal is attempted, **Then** the API's refusal is shown and the entry stays.
6. **Given** a recording, **When** it overlaps existing appointments or entries, **Then** the API accepts it, and the application has said that those appointments aren't changed and will be flagged for reception.

---

### User Story 8 - Reception can look up doctors and fees (Priority: P2)

A receptionist opens the doctor list, a doctor's page with their profile, hours, time off, slots, and fee, and the list of fees. All of it is read-only, and no change is offered.

**Why this priority**: Reception answers questions about hours and prices all day, though the booking screens matter more to them and arrive later.

**Independent Test**: Sign in as a receptionist, confirm that everything is visible and no change is offered, then confirm that the API's refusal is handled if a change is forced.

**Acceptance Scenarios**:

1. **Given** a receptionist, **When** they open any of these pages, **Then** the content appears with no control for changing it.
2. **Given** a receptionist or doctor, **When** they open an address for staff or specialties, **Then** the "not allowed" state appears, with no page content sent.
3. **Given** a doctor, **When** they open an address for the doctor directory or fees, **Then** the "not allowed" state appears.
4. **Given** a role changed mid-session, **When** the API answers `403` to an action, **Then** the "not allowed" state or message appears, whatever the screen believed.

---

### User Story 9 - A doctor sees their own hours (Priority: P3)

A doctor opens "My schedule" and sees their own weekly hours, upcoming slots, and time off. They can't change anything, and they are not shown a fee.

**Why this priority**: It is useful for doctors, but setup and booking don't depend on it. No other phase covers these endpoints, and its navigation entry already exists as a placeholder.

**Independent Test**: Sign in as a synthetic doctor with a schedule and with no schedule, and confirm each state.

**Acceptance Scenarios**:

1. **Given** a doctor with a schedule, **When** they open "My schedule", **Then** their hours, slots, and time off appear with no control for changing them.
2. **Given** a doctor with no schedule, **When** they open it, **Then** an empty state says that an administrator sets working hours.
3. **Given** a doctor with no profile, **When** they open it, **Then** the existing "profile not set up" state appears.

---

### Edge Cases

- Nothing was changed in an edit form when it is saved: no request is sent, and the form says there was nothing to save.
- An address holds an id that doesn't exist or isn't a number: the neutral not-found state appears.
- A record is removed or changed by another administrator while a form is open: the API's answer decides, and the last save wins, because the API offers no way to detect a conflict.
- A doctor's page partly fails, for example the fee can't be loaded: that section shows its own error and retry, and the others stay usable. The readiness summary shows that item as unknown, not missing.
- A doctor's schedule exists but all upcoming days are covered by time off: the slots item is incomplete and the reason can be seen from the page's other sections.
- The appointment length is longer than an existing period: the API's message appears against that period.
- The staff list has no name search (backend gap G1), so a long list is narrowed by role and status, then paged. The screen doesn't suggest a search it can't perform.
- More doctor-role accounts exist than fit in the account chooser: the administrator can page through them. Accounts are shown by name and email so that people with the same name can be told apart.
- A person is moved from the doctor role and back: their profile, schedule, and fee return as they were, because the API keeps them.
- The clinic's today differs from the browser's date, near midnight or on a computer in another time zone: dates default from the clinic's today.
- Names may be in either language and of any length: they display as written, in their own direction, without breaking tables or cards.
- A filter value in the address is invalid, for example an unknown role: the API's refusal is handled, and the screen doesn't fail outright.
- The session ends during a form: the usual sign-in redirect applies, and what was typed is not kept in any browser storage.

## Requirements *(mandatory)*

### Functional Requirements

**Readiness and the setup journey**

- **FR-001**: The doctor's page MUST show administrators a readiness summary with four items: active account, working hours set, slots offered in the coming 31 days, and fee set. Each MUST reflect the API's current answer, with each item stated in words and not by color alone.
- **FR-002**: The application MUST call a doctor bookable only when the API offers that doctor at least one slot, and MUST NOT work out bookability on its own. It MUST call setup complete only when the doctor is bookable and also has a fee. A bookable doctor with no fee MUST show a warning that visits can't be charged until a fee is set. A claim MUST be withheld only when it depends on an item that couldn't be determined because a request failed: if slots loaded and the fee didn't, the doctor still shows as bookable, and whether setup is complete is unknown.
- **FR-003**: Each setup step MUST offer the next one: a new doctor-role account offers profile creation for that account, and a new profile leads to the doctor's page, where the remaining items each lead to their step.
- **FR-004**: The doctor's page MUST show how many slots the API offers in the coming 31 days, and the first 7 dates that have slots with their times, as the API returns them. It MUST stay within the API's limits on date range.

**Staff accounts (administrators)**

- **FR-005**: Administrators MUST be able to list staff with role and status filters and paging, with both held in the address.
- **FR-006**: Administrators MUST be able to create an account with name, email, role, password, and confirmation. Quick feedback MUST cover the 12–72 character range and matching, and the API's answer MUST win.
- **FR-007**: Administrators MUST be able to view an account and change its name, email, and role, sending only what changed.
- **FR-008**: Administrators MUST be able to deactivate and reactivate an account, and set a new password for another person's account. Deactivating and setting a password MUST ask for confirmation and say that this ends the person's sessions.
- **FR-009**: Changing an account away from the doctor role MUST warn that the doctor becomes inactive and stops offering slots.
- **FR-010**: Deactivating or demoting one's own account MUST remain available, with a confirmation that says the person will lose access. The API's refusal MUST be shown when it refuses, including for the last active administrator. On one's own account, setting a password MUST be replaced by a link to the account page. This is the only action not offered on one's own account.
- **FR-011**: Passwords MUST NOT be shown back, kept after submission, or written to an address, log, or browser storage. There is no requirement to generate passwords.

**Specialties (administrators)**

- **FR-012**: Administrators MUST be able to list specialties with both names and status, add one with both names required, rename, deactivate, and reactivate. No delete MUST be offered.
- **FR-013**: Names MUST be displayed as stored, using the name for the active language wherever one is chosen for display, and both on the catalog screen.

**Doctors**

- **FR-014**: Administrators and receptionists MUST be able to list doctors with filters for name, specialty, and status, and paging, all held in the address. Doctor names in the address are permitted, as they are not patient data.
- **FR-015**: Administrators MUST be able to create a profile from an active doctor-role account, with title, optional registration number, and one or more specialties. A note MUST explain that accounts which already have a profile can't be excluded in advance (backend gap G2).
- **FR-016**: Administrators MUST be able to edit title, registration number, and specialties. The linked account MUST NOT be offered for change.
- **FR-017**: New specialty choices MUST be limited to active ones. Deactivated specialties already assigned MUST stay visible, identified as such, and may be kept.
- **FR-018**: Administrators and receptionists MUST be able to view a doctor's page with profile, hours, slots, time off, and fee, each with its own loading, error, and empty states. Change controls MUST appear for administrators only.

**Weekly schedule**

- **FR-019**: Administrators MUST be able to set the appointment length and up to the API's limit of periods per day for all seven days, saved as one whole week. Days MUST appear Sunday to Saturday, translated.
- **FR-020**: Refusals keyed to a period MUST appear against that period, even though the saved order may differ from the order on screen. Any other refusal MUST appear at form level.
- **FR-021**: Administrators MUST be able to clear a schedule, after a confirmation that says the doctor will then offer no slots.
- **FR-022**: Times MUST be shown as sent, with no time-zone conversion, including `24:00`.
- **FR-023**: Saving or clearing a schedule MUST state that existing appointments aren't moved or cancelled, and that reception will see affected ones flagged.

**Time off**

- **FR-024**: Administrators MUST be able to record whole days or part of a single day, with an optional reason. Administrators and receptionists MUST be able to view entries for a chosen range of up to 366 days, defaulting to the clinic's today onward.
- **FR-025**: The reason field MUST show the "no medical details" hint, and MUST state that all staff can read it.
- **FR-026**: Administrators MUST be able to remove an entry after confirming. Removal MUST NOT be offered when the end date is before the clinic's today. An entry ending earlier today MUST show the API's refusal.

**Fees**

- **FR-027**: Administrators MUST be able to set or change a doctor's fee from the doctor's page. Quick feedback MUST cover above 0, at most 100000, and at most two decimals, and the API's answer MUST win.
- **FR-028**: Administrators and receptionists MUST be able to view the paged fee list, with doctor, amount, setter, and time. A doctor with no fee MUST read "not set". Each row MUST lead to the doctor's page.
- **FR-029**: Amounts MUST be sent and held as strings, and displayed through the shared money display, and MUST NOT pass through floating-point arithmetic.
- **FR-030**: Changing a fee MUST state that existing charges keep the amount they were charged at.

**Doctor's own schedule**

- **FR-031**: Doctors MUST be able to view their own hours, slots, and time off, read-only, with the existing "profile not set up" state where it applies. No fee MUST be requested or shown.

**Access and navigation**

- **FR-032**: This phase's real pages MUST replace the "not available yet" placeholders for Doctors, Specialties, Fees, Staff, and My schedule. Later phases' placeholders MUST stay as they are.
- **FR-033**: Page access and change controls MUST follow the single role map, using the existing `Can` control where it fits. The API's `401`, `403`, and `404` MUST be handled on every screen and action, whatever the map says.

**Cross-cutting**

- **FR-034**: Every view MUST provide loading, error, empty, and success states, using the shared design system, with all text in both languages and working in both directions.
- **FR-035**: Every change MUST show progress, prevent double submission, show the API's message on the matching field or otherwise at form level, and confirm success.
- **FR-036**: Fixed identifiers such as roles and days MUST be translated by the application. Stored text MUST appear as written, never translated.
- **FR-037**: After a change, lists and pages showing that data MUST show the new values without a manual reload.
- **FR-038**: Instants such as "set at" MUST be shown in the clinic's time zone. Clinic dates and times MUST be shown as sent.
- **FR-039**: No page in this phase may read a patient record or make any audited read.

### Key Entities

- **Staff member**: A person's account: name, email, role, active flag. May exist with the doctor role before any doctor profile does.
- **Specialty**: A catalog entry with English and Arabic names and an active flag. Deactivated, never deleted.
- **Doctor**: A profile linked to one staff account: title, optional registration number, one or more specialties, and an active status derived from the account. Its id differs from the account's id.
- **Weekly schedule**: A doctor's appointment length and up to 4 working periods per day across seven days. May be absent.
- **Slot**: A bookable date and time range, computed by the API. Never computed by the application.
- **Time off**: A doctor's whole days, or part of one day, away, with an optional reason that all staff can read.
- **Fee**: A doctor's current charge amount, with who set it and when. May be not yet set, and once set can be changed but not removed.
- **Readiness**: A view over the above for one doctor. It is not stored anywhere, and it is not an API concept.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator can take a person from no account to a doctor with slots offered and a fee, using only the application, in under 5 minutes, and in 100% of test runs against the real API.
- **SC-002**: Every staff, specialty, doctor, scheduling, and fee operation that the screens use is exercised against the running API, with its fields and statuses confirmed to match the contract.
- **SC-003**: For each role, 100% of this phase's pages and change controls agree with the verified permission matrix, by automated comparison, and a forced action refused by the API shows a clear state.
- **SC-004**: Every refusal the API can give on this phase's forms appears on the correct field or at form level, with zero dropped, in both languages.
- **SC-005**: Every screen in this phase shows correct loading, error, empty, and success states, in both languages and directions.
- **SC-006**: Automated accessibility checks report no WCAG 2.2 AA violations on the new screens in either language or direction, and the setup journey can be finished by keyboard alone.
- **SC-007**: A fee entered as any valid two-decimal amount is displayed exactly as the API returned it, in 100% of tests.
- **SC-008**: Deactivating an account or setting its password ends that person's session, and they return to sign-in, in 100% of test runs against the real API.
- **SC-009**: Every quality check passes, and results recorded for this phase are ones actually observed.

## Assumptions

- The API doesn't require a fee in order to book, only in order to charge, which is why "bookable" and "setup complete" are separate facts. This phase is done when an administrator can reach "setup complete".
- The API never exposes which account a doctor belongs to (gap G2) and has no staff name search (gap G1). Decision Q7 in the roadmap is to work around both in the frontend, so nothing here matches accounts to doctors by name.
- A staff account's page doesn't link to the matching doctor, for the same reason. The doctor-role offer in FR-003 is available right after creation, when the account's id is known. It is also on the account's page, where the API's answer decides if a profile already exists.
- Existing appointments affected by a schedule change are listed in Phase 6, which builds appointments. This phase only states the effect.
- A fee can't be zero or removed, because the API doesn't allow it. Free consultations aren't a concept in this phase.
- Administrators choose the password they give to a new person, and hand it over outside the application. The API doesn't force a change at first sign-in, so the confirmation suggests that the person changes it on their account page.
- Reachable data here is staff and clinic data, not patient data, and none of it is an audited read.
- Live end-to-end tests run against the Docker backend, with synthetic accounts.

### Out of scope

A dedicated multi-step setup wizard, booking and any screen listing appointments, charging, doctor self-service changes, password generation, warnings about unsaved changes when leaving a form, a doctor directory for the doctor role, and any backend change.
