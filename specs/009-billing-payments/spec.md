# Feature Specification: Billing and Payments

**Feature Branch**: `009-billing-payments`

**Created**: 2026-11-08

**Status**: Accepted

**Input**: User description: "Start Phase 9" of `docs/roadmap.md`: billing and payments. Visits, charges, payments, administrator discount and refund, for administrators and receptionists only. Screens per `docs/frontend-blueprint.md`: Billing (a clinic date's visits with their charge status and balance, charge a visit at the doctor's current fee), Charges (find charges in a date range of at most 92 days by patient, doctor, and status), and one charge's page (every payment and refund; record a payment, confirmed first because payments are permanent; cancel a charge with no money held; administrator-only discount and refund). Backend contract: `specs/009-payments/contracts/payments.openapi.yaml`. Fees were delivered in Phase 4 and aren't repeated.

## Clarifications

### Session 2026-11-08

- Q: Should Billing refresh itself every 15 seconds while on screen, like the queue? → A: Only while it shows the clinic's today, on a visible tab, behaving as the queue's lists do. Other dates, and Charges, are read when opened, when a choice changes, after an action, and when the person asks.
- Q: Should the payment amount start filled in with the full balance? → A: Yes. The person can change it, and the confirmation repeats the amount before anything is recorded.
- Q: Should "Charge visit" ask for confirmation first? → A: No. One click charges and opens the charge ready for payment, as check-in needs none; a mistake is corrected by cancelling, which stays on record.
- Q: What range should Charges show before one is chosen? → A: The last 7 days: the clinic's today and the six days before it.
- Q: Should reception reach billing from where they already work? → A: A patient's page gains a "Charges" link, opening Charges for that patient over the last 7 days. Queue rows gain nothing.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Charge a visit at the desk (Priority: P1)

A patient has arrived and is on a doctor's list for today. Reception opens Billing, sees today's visits with what each one owes, and charges the patient's visit. The amount is the doctor's fee at that moment; reception never types it.

**Why this priority**: Nothing can be paid until a visit is charged. This is the first half of the phase's purpose.

**Independent Test**: Check in a synthetic patient with a doctor who has a fee. Open Billing, confirm the visit shows as not charged, charge it, and confirm the charge's page opens showing that fee, an unpaid status, and a balance equal to the fee. Confirm the audit trail gained `charge.created`, and no `patient.opened`.

**Acceptance Scenarios**:

1. **Given** Billing is opened with no choices made, **When** it appears, **Then** it lists the clinic's today's visits for all doctors in the API's order, grouped under each doctor's name.
2. **Given** a row, **When** it is shown, **Then** it gives the patient's number, name, and phone, the visit's queue status, a "walk-in" label where it applies, the charge status, and the balance where a charge exists.
3. **Given** another date, a doctor, or a charge status is chosen, **When** results appear, **Then** they match, and the choices and page number survive a reload and the back button.
4. **Given** a visit with no active charge, **When** its row is shown, **Then** "Charge visit" is offered. A row with an active charge links to that charge instead.
5. **Given** the person chooses "Charge visit", **When** the API accepts, **Then** the charge's page opens, a confirmation gives the amount charged, and it is ready to take a payment. No confirmation dialog comes first, because a charge with no money on it can be cancelled.
6. **Given** the doctor has no fee, the patient left, or the visit was already charged, for example by another person a moment earlier, **When** the API refuses, **Then** its message appears with the row, and the list is read again at once.
7. **Given** no visits on the date, or none that match, **When** the list finishes, **Then** an empty state says so in neutral words and keeps the choices.
8. **Given** a patient's name in a row, **When** a person follows it, **Then** the patient's record opens and writes one true opening. Showing, hovering over, or refreshing the row writes nothing.
9. **Given** Billing shows the clinic's today on a visible tab, **When** 15 seconds pass, **Then** it is read again as the queue's lists are: changes appear without a loading state replacing the list, the page says when it was last read and offers a refresh, a failed refresh keeps the last list with a notice, the person's focus and open menus are kept, and no read is made while the tab is hidden or another page is open.
10. **Given** Billing shows another date, **When** time passes, **Then** it isn't read again by itself, and a refresh is offered.

---

### User Story 2 - Record a payment (Priority: P1)

The patient pays all or part of what is owed, in cash, by card, or by wallet. Reception records the amount and method, checks them in a confirmation, and the balance updates. A patient can pay in several parts.

**Why this priority**: This is the purpose of the phase. With User Story 1 it is the smallest usable slice.

**Independent Test**: On a synthetic unpaid charge, record part of the balance in cash, confirming the status becomes partially paid and the balance falls by exactly that amount. Record the rest by card, confirming the status becomes paid, no further payment is offered, and the audit trail gained two `payment.recorded` entries.

**Acceptance Scenarios**:

1. **Given** an active charge with something owed, **When** its page is shown, **Then** "Record payment" is offered with an amount and a method, and the amount starts as the full balance, which the person can change.
2. **Given** the person submits, **When** the confirmation appears, **Then** it names the patient, the amount, and the method, and says a payment can't be edited or removed afterwards.
3. **Given** the person confirms, **When** the API accepts, **Then** the page shows the charge as the API returned it, with the new payment, amount paid, balance, and status, and a confirmation says what was recorded.
4. **Given** an amount that is zero, above the balance, or has more than two decimal places, **When** it is submitted, **Then** the person is told on the amount field before anything is sent where that can be known, and the API's message appears on the field when it refuses.
5. **Given** another person changed the charge since it was read, for example by recording a payment or cancelling it, **When** the API refuses, **Then** its message appears, and the charge is read again at once so the screen shows what is true.
6. **Given** a payment was submitted and no answer arrived, for example because the connection dropped, **When** the person returns to the form, **Then** nothing is sent again by itself. The charge is read again, and the page says to check its payments before recording the money a second time.
7. **Given** a charge that is paid or cancelled, **When** its page is shown, **Then** no payment is offered.

---

### User Story 3 - See one charge in full (Priority: P1)

Anyone at the desk can open a charge and answer "what was charged, what was paid, and by whom?".

**Why this priority**: Every action on money lives on this page, and the person must see the facts before acting.

**Independent Test**: Open a synthetic charge with two payments, a discount, and a refund, confirming every amount, person, time, method, and reason appears exactly as the API sent it. Reload the page, confirming the audit trail gained no entry.

**Acceptance Scenarios**:

1. **Given** a charge, **When** its page is shown, **Then** it gives its status, the clinic date, the doctor, the patient's number, name, and phone, who charged it and when, and the fee, discount, amount due, amount paid, and balance.
2. **Given** payments and refunds, **When** they are shown, **Then** each gives its amount, method, time, and staff member, and each refund its reason, oldest first, in the order the API sent them.
3. **Given** a discount, **When** it is shown, **Then** the original fee stays visible beside it, with its reason, who set it, and when.
4. **Given** a cancelled charge, **When** its page is shown, **Then** it says it is cancelled, with the reason, who, and when, and offers no action. If its visit no longer exists because its check-in was undone, the page says so.
5. **Given** an address naming a charge that doesn't exist, or an id that isn't valid, **When** it is opened, **Then** a neutral not-found state appears.
6. **Given** the page is open, **When** it is shown, re-shown after another tab, or a link to it is hovered, **Then** it is read only when the person opens it or an action needs it again.

---

### User Story 4 - Find charges and what is owed (Priority: P2)

Reception wants to find a patient's charges, a doctor's charges, or everything still unpaid over a period.

**Why this priority**: Unpaid balances are lost income, but a clinic can start by charging at the desk.

**Independent Test**: Create synthetic charges with different statuses, doctors, and patients across several days. Filter by each and confirm the matching charges appear, newest first. Choose a range longer than 92 days and confirm the person is told before anything is sent.

**Acceptance Scenarios**:

1. **Given** Charges is opened with no choices made, **When** it appears, **Then** it lists the charges of the last 7 days, the clinic's today and the six days before it, newest first.
2. **Given** a row, **When** it is shown, **Then** it gives the clinic date, status, doctor, patient's number, name, and phone, fee, discount, amount due, amount paid, and balance, and links to the charge's page.
3. **Given** a range, patient, doctor, or status is chosen, **When** results appear, **Then** they match, and the choices and page number survive a reload and the back button.
4. **Given** a range longer than 92 days including both ends, or an end before its start, **When** it is chosen, **Then** the person is told on the range before anything is sent, and the API's message appears when it refuses.
5. **Given** a patient is chosen, **When** they are found, **Then** the search follows Phase 5's rules and choosing one doesn't open their record or write an opening. Only the patient's number appears in the address.
6. **Given** no charges match, **When** the list finishes, **Then** an empty state says so in neutral words and keeps the choices.
7. **Given** a patient's page, shown to an administrator or receptionist, **When** a person follows "Charges", **Then** Charges opens for that patient over the last 7 days, the patient is shown as chosen without opening their record again or writing another opening, and only the patient's number appears in the address.

---

### User Story 5 - Cancel a mistaken charge (Priority: P2)

A visit was charged by mistake, or charged before the patient decided to leave. While no money is held on it, reception or an administrator cancels it with a reason. The charge stays on record, and the visit can be charged again.

**Why this priority**: Without it, a mistaken charge blocks undoing a check-in and leaves a false balance.

**Independent Test**: Charge a synthetic visit, cancel it with a synthetic reason, and confirm it shows as cancelled with the reason, that Billing offers "Charge visit" again, and that the audit trail gained `charge.cancelled`.

**Acceptance Scenarios**:

1. **Given** an active charge whose amount paid is zero, **When** its page is shown, **Then** "Cancel charge" is offered. It isn't offered while money is held.
2. **Given** the person chooses it, **When** the confirmation appears, **Then** it asks for a reason of up to 500 characters, says not to enter medical details, and says cancelling can't be undone but the visit can be charged again.
3. **Given** the person confirms, **When** the API accepts, **Then** the page shows the charge as cancelled.
4. **Given** money was received meanwhile, or the charge was already cancelled, **When** the API refuses, **Then** its message appears and the charge is read again at once.

---

### User Story 6 - An administrator gives a discount (Priority: P3)

The clinic reduces or waives a fee for a patient in need. An administrator sets a discount with a reason, and can replace or remove it later.

**Why this priority**: Discounts happen, but less often than the main flow.

**Independent Test**: As a synthetic administrator, discount an unpaid charge, confirming the amount due and balance fall and the fee is unchanged. Discount it to the whole fee, confirming it shows as paid. Confirm a receptionist sees no discount action, and is refused if they try anyway.

**Acceptance Scenarios**:

1. **Given** an administrator on an active charge, **When** its page is shown, **Then** "Set discount" is offered with an amount and a reason. Receptionists aren't offered it.
2. **Given** a charge already has a discount, **When** the form opens, **Then** it starts from the current discount, and says that saving replaces it, and that a discount of zero removes it.
3. **Given** the administrator saves, **When** the API accepts, **Then** the page shows the new amount due, balance, and status, and the fee unchanged.
4. **Given** a discount larger than the fee less the amount paid, with no reason, or with more than two decimal places, **When** it is submitted, **Then** the message appears on the matching field.

---

### User Story 7 - An administrator records a refund (Priority: P3)

A patient paid too much, or a payment was recorded against the wrong visit. Payments can't be changed, so an administrator records money returned, with its method and a reason.

**Why this priority**: Financial records must stay correct, but corrections are rare.

**Independent Test**: As a synthetic administrator, refund part of a paid charge, confirming the amount paid falls, the balance rises, the status updates, the original payment is unchanged, and the audit trail gained `refund.recorded`.

**Acceptance Scenarios**:

1. **Given** an administrator on an active charge with money received, **When** its page is shown, **Then** "Record refund" is offered with an amount, a method, and a reason. Receptionists aren't offered it, and nobody is offered it when the amount paid is zero.
2. **Given** the administrator submits, **When** the confirmation appears, **Then** it names the patient, the amount, and the method, and says a refund can't be edited or removed afterwards.
3. **Given** the administrator confirms, **When** the API accepts, **Then** the page shows the charge as the API returned it, with the refund and its reason.
4. **Given** an amount above the amount paid, zero, or with more than two decimal places, or no reason, **When** it is submitted, **Then** the message appears on the matching field.
5. **Given** a refund was submitted and no answer arrived, **When** the person returns to the form, **Then** nothing is sent again by itself, the charge is read again, and the page says to check its refunds first.

---

### Edge Cases

- **Doctors.** Doctors have no billing navigation and no billing route. If a doctor reaches an address directly, the forbidden state appears.
- **Roles changing mid-session.** A receptionist who is shown an administrator action because of a stale role, or an administrator who was demoted, sees the API's refusal as a forbidden state or message. Hiding actions is never relied on.
- **Money exactness.** Every amount is shown exactly as the API sent it, to the piastre, with the currency named in the active language. No amount is computed by the frontend; the API's fee, discount, amount due, amount paid, and balance are shown as they are.
- **Amounts in Arabic.** Amounts are entered with Western digits and a dot, and stay left-to-right inside Arabic text.
- **Inactive doctors.** A deactivated doctor's visits still appear and can still be charged, as the API allows.
- **Left visits.** A visit marked as left appears only if it has an active charge, which can still be paid, refunded, or cancelled. It can't be newly charged.
- **Undoing a check-in.** Phase 7's queue already shows the API's refusal while a visit has an active charge. This phase adds nothing to the queue, but the refusal's message should lead reception to cancel the charge first.
- **Other days.** Billing can show any date's visits, so a visit from an earlier day can still be charged and paid. Queue lists only reach today (gap G8), so an earlier visit never appears on the queue.
- **Reasons.** Discount, refund, and cancel reasons are free text. The forms say not to enter medical details. Reasons appear only on the charge's own page, never in lists, addresses, or logs.
- **Double submission.** Every money action is disabled while it is being sent, and is never sent twice by itself, including after a timeout or a lost connection.
- **No receipts.** There is no print or receipt endpoint (gap G7); nothing in this phase prints.
- **Totals.** Billing and Charges show rows only. Totals over a period belong to Phase 10's reports.

## Requirements *(mandatory)*

### Functional Requirements

**Access**

- **FR-001**: Billing and Charges MUST appear in the navigation of administrators and receptionists only, and the role-to-action mapping MUST live in the one permissions map.
- **FR-002**: Every screen MUST handle the API's unauthenticated, forbidden, and not-found answers, whatever the interface believed the role could do.

**Billing**

- **FR-003**: Billing MUST list one clinic date's visits, the clinic's today by default, optionally narrowed to one doctor and one charge status (`none`, `unpaid`, `partially_paid`, `paid`), in the API's order, grouped by doctor, in pages.
- **FR-003a**: While Billing shows the clinic's today on a visible tab, it MUST be read again every 15 seconds, following Phase 7's refresh behavior (roadmap decisions Q2 and Q4). Other dates MUST NOT be read on a timer.
- **FR-004**: Billing MUST offer charging a visit that has no active charge, and MUST link a visit that has one to its charge.
- **FR-005**: Charging MUST send no amount. The amount comes from the API.

**Charges**

- **FR-006**: Charges MUST list charges for a range of at most 92 days including both ends, the last 7 days ending on the clinic's today by default, optionally narrowed to one patient, one doctor, and one status (`unpaid`, `partially_paid`, `paid`, `cancelled`), newest first, in pages.
- **FR-006a**: A patient's page MUST offer administrators and receptionists a "Charges" link that opens Charges for that patient over the last 7 days.
- **FR-007**: A charge's page MUST show every field the API returns for it, including every payment and refund, as described in User Story 3.

**Money actions**

- **FR-008**: Administrators and receptionists MUST be able to record a payment with an amount and a method (`cash`, `card`, `wallet`) on an active charge with a balance, after a confirmation that names the patient, amount, and method and says it is permanent.
- **FR-009**: Administrators and receptionists MUST be able to cancel an active charge whose amount paid is zero, with a reason of up to 500 characters, after a confirmation that says it can't be undone.
- **FR-010**: Administrators MUST be able to set, replace, or remove a discount on an active charge, with an amount and a reason of up to 500 characters.
- **FR-011**: Administrators MUST be able to record a refund on an active charge with money received, with an amount, a method, and a reason of up to 500 characters, after a confirmation that says it is permanent.
- **FR-012**: After any money action, the page MUST show the charge exactly as the API returned it.
- **FR-013**: A money action MUST NOT be retried or sent again automatically, including after a timeout or lost connection. When its outcome is unknown, the charge MUST be read again and the person told to check it before acting again.
- **FR-014**: When the API refuses a money action because the charge changed, the charge or list MUST be read again at once.
- **FR-015**: Amount fields MUST accept at most two decimal places; payment and refund amounts MUST be above zero, and a discount MAY be zero, which removes it. Checks before sending MUST be for faster feedback only; the API's answer decides.

**Money and display**

- **FR-016**: Money MUST stay a string from the API to the screen and MUST NOT be converted to a floating-point number. Amounts the person types MUST be sent as strings.
- **FR-017**: Statuses and methods MUST be shown translated, with a text label and a status tone following the design system's charge mapping, never by color alone.
- **FR-018**: Clinic dates MUST be shown as sent, and instants (`charged_at`, `received_at`, and the others) in the clinic's time zone.

**Privacy**

- **FR-019**: Lists and charges MUST be read only as the result of a person's action or a change they made, apart from Billing's timed refresh of today (FR-003a). Reading a charge or list writes no audit entry, but links to patient records MUST NOT be prefetched, as opening one does.
- **FR-020**: Reasons, amounts, and patient details MUST NOT appear in addresses, logs, or persistent browser storage. Only identifiers, dates, and fixed filter values may appear in addresses.
- **FR-021**: All user-facing text MUST exist in English and Arabic, and every screen MUST work in both directions.

### Key Entities *(include if feature involves data)*

- **Visit (billing view)**: A queue entry on a clinic date, with its doctor, the patient's summary, its queue status, whether it was a walk-in, and its active charge's status and balance, if any.
- **Charge**: What one visit costs: the fee when charged, any discount with its reason, the amount due, amount paid, and balance, its status, who charged it and when, and when and why it was cancelled.
- **Payment**: Money received on a charge: amount, method, staff member, and time. Never edited.
- **Refund**: Money returned on a charge: amount, method, reason, staff member, and time. Never edited.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A receptionist can go from Billing to a fully paid charge for an arrived patient in under 30 seconds of work.
- **SC-002**: In automated tests, 0 money actions are sent more than once for one confirmation, including when the request fails, times out, or is clicked repeatedly.
- **SC-003**: 100% of amounts on screen match the API's strings exactly, including after 100 small part payments on one charge.
- **SC-004**: Automated tests cover every action for each role: administrators see and can use all of them, receptionists see no discount or refund, and doctors reach no billing screen.
- **SC-005**: Every screen has loading, error, empty, and success states in both languages and both directions, with no hard-coded user-facing text and no accessibility violations in automated checks.
- **SC-006**: 0 reasons, amounts, or patient details appear in addresses, logs, or browser storage in automated checks.

## Assumptions

- The backend's Phase 9 module (`specs/009-payments`) is final, and its contract is the source of every field, filter, and refusal used here.
- Fees, Phase 4's screens, are unchanged. A missing fee is found through the API's refusal when charging.
- Doctors' earnings or a doctor's view of payments are out of scope, as the API gives doctors no access.
- Totals, daily cash balancing, receipts, and printing are out of scope: totals belong to Phase 10, and printing to no phase (decision Q5).
- Charges, a charge's page, and Billing on any date but today aren't refreshed on a timer. They are read when opened, when a choice changes, after an action, and when the person asks.
- The patient picker on Charges behaves like the one in Phase 6's appointment list.
- Queue rows gain no billing link in this phase.
