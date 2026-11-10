# Screens: Billing and Payments

Each screen's states. All text is in `billing.*` and `charges.*`, in both languages. Statuses and methods use
`shared.status.charge` and a new `shared.paymentMethod`. Every screen is checked with axe in both directions.

## Billing, `/billing`

Administrators and receptionists. Gate: `billing`.

| State | Shown |
|---|---|
| Loading | The filters, and a loading state in place of the list |
| First read failed | Error state with "Try again" |
| `403` | Forbidden state; patient details cleared; reading stops |
| Empty, no choices | "No visits on this date", neutral, with a link to the queue when the date is today |
| Empty, narrowed | "No visits match", with the filters kept |
| Success | Groups by doctor, in the API's order. Each row: patient number, name (a `PatientLink`, never prefetched), phone (LTR), queue status, "walk-in" where it applies, charge status, balance or a dash, and "Charge visit" or a link to the charge |
| Today | The last-read time and "Refresh", reading every 15 seconds on a visible tab. A failed refresh keeps the list with "may be out of date" |
| Another date | "Refresh" only. No timer, no reading on focus |
| Charging | That row's button busy and disabled, the others usable |
| Charge refused | A notice above the list naming the patient, with the API's message; the list read again at once |
| Charged | Navigation to the charge's page, with a confirmation of the amount charged |

Filters: date, doctor (active and inactive, labelled), charge status. All in the address.

## Charges, `/charges`

Administrators and receptionists. Gate: `charges`.

| State | Shown |
|---|---|
| Loading | The page's loading state |
| Range invalid | The filters with a message on the range; no list, no read |
| Read failed | Error state with "Try again" |
| `403` | Forbidden state |
| `422` | The API's messages with the filters |
| Empty | "No charges in this range" or "No charges match", with the filters kept |
| Success | Newest first. Each row: date, status, doctor, patient number, name, phone, fee, discount, amount due, amount paid, balance, and a link to the charge |

Filters: from, to (default the last 7 days), doctor, status, and the patient filter beside them. Paging below the table.

## A charge, `/charges/[id]`

Administrators and receptionists. Gate: `charges`.

| State | Shown |
|---|---|
| Loading | The page's loading state |
| Not a valid id, or `404` | Neutral not-found state, with a link to Charges |
| `403` | Forbidden state |
| Read failed | Error state with "Try again" |
| Success | Status, date, doctor, patient (number, name as a `PatientLink`, phone), charged by and when. Amounts: fee, discount, amount due, amount paid, balance. The discount's reason, by, and when. Payments, then refunds, each with amount, method, time, staff member, and the refund's reason |
| Cancelled | "Cancelled" with reason, by, and when. No actions. "This visit no longer exists" when `visit_id` is null |
| Paid | No payment form. Discount and refund still offered to administrators |
| Outcome unknown | A notice above the payments: the action may have been recorded, check below before trying again |

### Record payment

Shown while something is owed. Amount (starting as the balance), method (cash, card, wallet; none chosen), and "Record payment".

| Step | Shown |
|---|---|
| Invalid before sending | The message on the field; nothing sent |
| Confirm | Names the patient, amount, and method; says a payment can't be edited or removed. Opens on the safe choice |
| Sending | Both buttons disabled |
| Recorded | The dialog closes; a confirmation states the amount and method; the page shows the charge as it now is; the form resets to the new balance |
| Refused | The API's messages on the fields or at form level; the charge read again |
| Unknown outcome | The dialog closes; the notice above the payments; the page read again; what was typed is kept |

### Record refund (administrators)

Shown while money is held. Amount, method (none chosen), reason (500 characters, "don't enter medical details"). Confirmation names the
patient, amount, and method, and says a refund can't be edited or removed. Otherwise as for a payment.

### Set discount (administrators)

Shown on an active charge. Amount, starting from the current discount, and reason. Says that saving replaces the discount, and that zero
removes it. No confirmation. Saved: the new amount due, balance, and status, with the fee unchanged.

### Cancel charge

Shown while the amount paid is zero. The dialog asks for a reason (500 characters, "don't enter medical details"), and says cancelling
can't be undone and the visit can be charged again. Cancelled: the page shows the cancelled state.

## The patient's page, changed

"Charges" joins its links for administrators and receptionists, opening `/charges?patient_id=N`. Nothing else changes, and the link is never
prefetched.
