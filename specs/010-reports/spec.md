# Feature Specification: Reports

**Feature Branch**: `010-reports`

**Created**: 2026-11-08

**Status**: Draft

**Input**: User description: "Start Phase 10" of `docs/roadmap.md`: reports, for administrators only. Four read-only reports per `docs/frontend-blueprint.md` `/reports/*`: Money collected (received, refunded, and net, by method, by staff member within each method, and by day; net can be negative), Billing (per doctor: active charges, fees, discounts, amount due, amount paid, balance, cancelled charges, and uncharged seen visits, with overall totals, in pages), Activity (per doctor: appointments by status, no-show rate, visits by status and booked or walk-in, and overall new patients, which the API leaves out when one doctor is chosen, in pages), and Times (per doctor: average wait and consultation in minutes with the visits each covers, and seen visits by record state, in pages). Every report needs a clinic-date period of at most 366 days including both ends, and may be narrowed to one doctor. Missing averages and a missing no-show rate are shown as "not available", never as zero. The charting library is decided in this phase. Backend contract: `specs/010-reports/contracts/reports.openapi.yaml` and `data-model.md`. Started from the Phase 9 branch, as that PR isn't merged yet.

## Context

Phases 6 to 9 record appointments, visits, medical records, charges, and money one at a time. An administrator can't yet answer "how much came in this month, what is still owed, and how busy was each doctor?" without adding it up by hand. The API answers these questions with four summaries over a chosen period; this phase shows them.

Reports only read. They hold totals and counts, never a patient's details or clinical content, and reading one writes no audit entry (confirmed in the backend's Reports module, which records nothing). They show the records as they stand at the moment of reading: money collected for a past period never changes, as payments and refunds are permanent, but billing and activity for a past period can, as charges and appointments change.

## Clarifications

### Session 2026-11-08

- Q: Which period should Reports show before one is chosen? → A: This month in the clinic's calendar, from its first day to today, with shortcuts for today, the last 7 days, this month, and last month.
- Q: Which figures should be charted? → A: Only Money collected's breakdown by day, beside its table. Billing, Activity, and Times are tables only, as a chart over one page of doctors would compare only that page.
- Q: What should the Billing report be called, as the desk screen is already "Billing"? → A: "Charges by doctor". Its address stays `/reports/billing`, matching the API.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the money collected (Priority: P1)

At the end of a day or a month, an administrator checks how much money came in, how much went back out, and the difference, in each method and through which staff member, so the cash can be checked against the records.

**Why this priority**: This is the clinic's most frequent financial question, and the total that Phase 9 left to this phase. It is the smallest usable slice.

**Independent Test**: With synthetic payments in cash and by card from two staff members, and a refund on a later day, open Money collected for the period and confirm every total and breakdown matches the API's figures exactly, and that the refund appears on its own day.

**Acceptance Scenarios**:

1. **Given** Reports is opened with no choices made, **When** it appears, **Then** Money collected is shown for the default period (see Assumptions), and the period and doctor chosen are stated above the figures.
2. **Given** a period with money movement, **When** the report is shown, **Then** it gives the money received, the money refunded, and the net for the whole period.
3. **Given** the same report, **When** its breakdowns are shown, **Then** they give each method that had money movement, in the order the API sent them, with each staff member's figures within it, and each day that had money movement, oldest first, each with received, refunded, and net.
4. **Given** the breakdown by day, **When** it is shown, **Then** it appears both as a chart and as a table holding the same figures, and the table alone is enough to read every figure.
5. **Given** a net below zero, for example on a day with only a refund, **When** it is shown, **Then** it is shown as a negative amount, clearly marked as such in both languages and directions, and the chart shows it below its zero line.
6. **Given** one doctor is chosen, **When** the report is shown, **Then** it says only money on that doctor's charges is counted.
7. **Given** a period with no money movement, **When** the report is shown, **Then** the totals are zero and an empty state says no money was received or refunded in the period, keeping the choices.

---

### User Story 2 - Choose the period and the doctor (Priority: P1)

The administrator asks the same questions for different stretches of time and for one doctor at a time. The choices carry across the four reports, so moving from money to activity doesn't mean choosing again.

**Why this priority**: Every report needs a period. Without this, User Story 1 can show only its default.

**Independent Test**: Choose a period and a doctor on Money collected, move to Activity, and confirm the same choices apply. Reload and use the back button, confirming they survive. Choose a period of 367 days and confirm the person is told before anything is sent.

**Acceptance Scenarios**:

1. **Given** any report, **When** it is shown, **Then** the person can choose a start date, an end date, and optionally one doctor, and can move to the other three reports.
2. **Given** a period or doctor is chosen, **When** the person moves to another report, reloads, or goes back, **Then** the same choices apply, and they appear in the address as dates and a doctor's number only.
3. **Given** a period longer than 366 days including both ends, an end before its start, or a missing date, **When** it is chosen, **Then** the person is told on the matching date before anything is sent, and the API's message appears on that date if it refuses.
4. **Given** a doctor's number in the address that the API doesn't know, **When** the report is read, **Then** a neutral message says that doctor wasn't found, and the person can clear the doctor and keep the period.
5. **Given** the doctor choice, **When** it is offered, **Then** it lists the clinic's doctors, including deactivated ones, as their past figures still count.
6. **Given** a shortcut such as today or this month, **When** it is chosen, **Then** it sets both dates using the clinic's calendar, not the computer's.

---

### User Story 3 - See what was charged and what is owed, by doctor (Priority: P2)

Shown as **Charges by doctor**, so it can't be mistaken for the Billing desk screen.

An administrator checks what each doctor's visits were charged, what was discounted, what was paid, and what is still owed, and spots visits that were seen but never charged.

**Why this priority**: Unpaid balances and uncharged visits are lost income, but the money actually received comes first.

**Independent Test**: With synthetic charges for two doctors, one partly paid, one discounted, one cancelled, and one seen visit never charged, open Billing for the period and confirm each doctor's row and the overall totals match the API's figures exactly.

**Acceptance Scenarios**:

1. **Given** a period, **When** the report is shown, **Then** it gives one row per doctor, in the API's order, with the doctor's name and title as stored, the number of active charges, fees, discounts, amount due, amount paid, balance, cancelled charges, and uncharged seen visits.
2. **Given** the same report, **When** it is shown, **Then** overall totals for every doctor appear apart from the rows, labelled as covering all doctors whichever page is shown.
3. **Given** more doctors than one page holds, **When** the person moves between pages, **Then** the rows change and the totals stay the same, and the page number survives a reload and the back button.
4. **Given** cancelled charges, **When** they are shown, **Then** the report says they are counted only and are in no amount.
5. **Given** uncharged seen visits above zero, **When** they are shown, **Then** they stand out with a text label, not color alone.
6. **Given** no charges and no seen visits in the period, **When** the report is shown, **Then** the zero totals appear and an empty state says nothing was charged in the period.

---

### User Story 4 - See how busy each doctor was (Priority: P2)

An administrator checks how many appointments each doctor had and how they ended, how often patients didn't come, how many visits there were and how many were walk-ins, and how many new patients the clinic registered.

**Why this priority**: It guides scheduling and staffing, but money questions come first.

**Independent Test**: With synthetic appointments in every status and visits booked and walk-in, open Activity and confirm every count and the no-show rate match the API. Choose one doctor and confirm the new-patients figure is replaced by a note, not a zero. Choose a period with no attended appointments and confirm the rate says "not available".

**Acceptance Scenarios**:

1. **Given** a period, **When** the report is shown, **Then** it gives one row per doctor, in the API's order, with appointments scheduled, cancelled, no-show, checked in, and completed, the no-show rate, and visits waiting, with the doctor, seen, and left, and booked and walk-in.
2. **Given** the same report, **When** it is shown, **Then** overall totals appear apart from the rows, as in Billing, including the number of new patients registered in the period.
3. **Given** a no-show rate from the API, **When** it is shown, **Then** it appears as a percentage exactly as sent, to one decimal place, with how it is worked out stated nearby: no-shows among appointments that were no-shows, checked in, or completed.
4. **Given** the API sends no no-show rate, because nothing it counts happened, **When** it is shown, **Then** it reads "not available", not zero.
5. **Given** one doctor is chosen, **When** the totals are shown, **Then** new patients isn't shown as a number; a note says the count is for the whole clinic and isn't given for one doctor.
6. **Given** no appointments and no visits, **When** the report is shown, **Then** the zero totals appear and an empty state says so in neutral words.

---

### User Story 5 - See waiting and consultation times, and records left unfinished (Priority: P3)

An administrator checks how long patients waited to be called and how long consultations took, and how many seen visits have a finalized record, only a draft, or none.

**Why this priority**: It's useful for running the clinic well, but less urgent than money and activity.

**Independent Test**: With synthetic visits that were called and finished at known times, and seen visits with a finalized record, a draft, and none, open Times and confirm the averages, the visits they cover, and the record counts match the API. Choose a period with no called visits and confirm both averages say "not available".

**Acceptance Scenarios**:

1. **Given** a period, **When** the report is shown, **Then** it gives one row per doctor, in the API's order, with the average wait in whole minutes and the number of visits it covers, the average consultation in whole minutes and the number of visits it covers, and seen visits with a finalized record, a draft, and no record.
2. **Given** the same report, **When** it is shown, **Then** overall totals appear apart from the rows, and say they are worked out from every visit, not averaged from the doctors' averages.
3. **Given** the API sends no average, because no visit is covered, **When** it is shown, **Then** it reads "not available", not zero.
4. **Given** drafts or visits with no record above zero, **When** they are shown, **Then** they stand out with a text label, not color alone.
5. **Given** no visits, **When** the report is shown, **Then** an empty state says so in neutral words.

---

### Edge Cases

- **Other roles.** Receptionists and doctors have no Reports navigation. If one reaches a report's address directly, the forbidden state appears; the API's refusal decides, not the navigation.
- **Roles changing mid-session.** An administrator demoted while a report is open sees the forbidden state on the next read.
- **Money exactness.** Every amount is shown exactly as the API sent it, to the piastre, with the currency named in the active language. No figure is added, subtracted, or averaged by the frontend, including totals, which come from the API. Amounts and numbers stay left-to-right inside Arabic text.
- **Charts and exact money.** A chart may need sizes, but the figures it labels are the API's strings. Sizes are worked out from exact whole-piastre amounts, never from rounded or floating-point money, so a bar never contradicts its label.
- **Charts and accessibility.** Every chart has a table with the same figures, its meaning is never carried by color alone, and it works in both directions, with time running from the start of the reading direction.
- **Periods that change.** The report states when it was read, in the clinic's time zone, and offers reading it again. Billing and activity for a past period can change; money collected for a past period can't.
- **Today's figures.** A report including today isn't read again on a timer; it's read when opened, when a choice changes, and when the person asks.
- **Names.** Doctor and staff names are shown exactly as stored, never translated. A doctor without a title shows the name alone.
- **Long periods.** A full year of money by day can hold up to 366 rows; the table stays readable and the chart stays legible at that size.
- **Paging past the end.** A page number beyond the last page, for example after doctors were removed from the results, is replaced with the last page, as Billing does, since "nothing here" would be untrue.
- **No patient data.** No report holds a patient's details or clinical content, so nothing here opens a record or writes an audit entry, and links on these pages may be prefetched.

## Requirements *(mandatory)*

### Functional Requirements

**Access**

- **FR-001**: Reports MUST appear in the navigation of administrators only, through the one permissions map.
- **FR-002**: Every report MUST handle the API's unauthenticated, forbidden, not-found, and validation answers, whatever the interface believed the role could do.

**Choices**

- **FR-003**: Every report MUST be read for a period of clinic dates, both included, and MAY be narrowed to one doctor. The four reports MUST share these choices, and they MUST survive moving between reports, reloading, and going back.
- **FR-004**: A period longer than 366 days including both ends, an end before its start, or a missing date MUST be reported to the person before anything is sent. These checks are for faster feedback only; the API's answer decides.
- **FR-005**: The period MUST default as stated in Assumptions, and shortcuts MUST use the clinic's calendar.
- **FR-006**: Only dates, a doctor's number, a page number, and which report is shown MAY appear in the address.

**Money collected**

- **FR-007**: Money collected MUST show received, refunded, and net for the period, by method with each staff member within it, and by day, in the API's order.
- **FR-008**: The breakdown by day MUST be shown as a chart and as a table with the same figures.

**Billing, Activity, and Times**

- **FR-009**: Billing, Activity, and Times MUST show one row per doctor in the API's order, in pages, as tables with no chart, with the API's overall totals shown apart from the rows and labelled as covering all doctors.
- **FR-010**: Billing MUST show every figure in User Story 3, Activity every figure in User Story 4, and Times every figure in User Story 5.
- **FR-011**: When the API leaves out new patients, because a doctor is chosen, Activity MUST say why instead of showing a number.

**Display**

- **FR-012**: Money MUST stay a string from the API to the screen and MUST NOT be converted to a floating-point number. A net below zero MUST be shown as negative without relying on color.
- **FR-013**: A missing average or no-show rate MUST be shown as "not available", never as zero or a blank.
- **FR-014**: The no-show rate MUST be shown as sent, with its meaning stated. Averages MUST be shown as whole minutes as sent, with the number of visits they cover.
- **FR-015**: Methods and statuses MUST be shown translated; names MUST be shown as stored.
- **FR-016**: Each report MUST state its period, the doctor if one is chosen, and when it was read, in the clinic's time zone, and MUST offer reading it again.
- **FR-017**: Every chart MUST have an equivalent table, MUST NOT carry meaning by color alone, and MUST work in both directions and both themes.

**Reading**

- **FR-018**: A report MUST be read when opened, when a choice or page changes, and when the person asks, and MUST NOT be read on a timer.
- **FR-019**: Every report MUST have loading, error, empty, and success states. A failed read MUST say so and offer trying again; a failed reread MUST keep the figures already shown, marked as possibly out of date.
- **FR-020**: All user-facing text MUST exist in English and Arabic, and every report MUST work in both directions.

### Key Entities *(include if feature involves data)*

- **Period**: A start and end clinic date, both included, at most 366 days.
- **Money figures**: Received, refunded, and net, for the period, a method, a staff member within a method, or a day. Net can be negative.
- **Billing figures**: For a doctor or all doctors: active charges, fees, discounts, amount due, amount paid, balance, cancelled charges, and uncharged seen visits.
- **Activity figures**: For a doctor or all doctors: appointments by status, the no-show rate (which may be missing), visits by status and by booked or walk-in, and, overall only, new patients.
- **Times figures**: For a doctor or all doctors: average wait and consultation (which may be missing), the visits each covers, and seen visits by record state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator can open the money collected for any period of up to a year, for the clinic or one doctor, in under 20 seconds of work.
- **SC-002**: 100% of figures on screen match the API's values exactly in automated tests, including negative nets, amounts above a million pounds, and a year of daily rows.
- **SC-003**: 0 missing averages or no-show rates are shown as zero in automated tests.
- **SC-004**: Automated tests confirm administrators reach all four reports and receptionists and doctors reach none, in both languages.
- **SC-005**: Every report has loading, error, empty, and success states in both languages, both directions, and both themes, with no hard-coded user-facing text and no accessibility violations in automated checks, charts included.
- **SC-006**: Every figure in a chart is also readable in its table, with no information found only in the chart.

## Assumptions

- The backend's Reports module (`specs/010-reports`) is final, and its contract is the source of every field, filter, and refusal used here. Reports write no audit entry and aren't rate limited, as its source confirms.
- The default period is the current month in the clinic's calendar, from its first day to today. Shortcuts offered: today, the last 7 days, this month, and last month (clarified 2026-11-08).
- Only money by day is charted; Billing, Activity, and Times have no chart (clarified 2026-11-08).
- The charting library is chosen in planning and recorded as an ADR and in `docs/tech-stack.md`; drawing simple charts without a library is one of the options considered.
- Reports open at a single Reports entry in the navigation, with the four reports reached from there.
- File downloads, printing, and exports are out of scope, as the API offers none and decision Q5 excludes printing. A page can still be printed by the browser.
- Links from report figures to the records behind them (for example, from uncharged seen visits to Billing) are out of scope: the API's other lists don't accept a period that matches a report's, so such a link couldn't show the same set.
- Today's figures on dashboards belong to Phase 12, which will reuse these reports.
