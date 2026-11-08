# Research: Billing and Payments

Findings and decisions for [plan.md](plan.md). Everything about the API was checked in `contracts/payments.openapi.yaml` (identical to the
backend's `specs/009-payments`, at the commit in `contracts/SOURCE.json`, which is the backend's current `main`) and in the backend's
source, `app/Modules/Payments`.

## Facts from the backend

| Fact | Where |
|---|---|
| No read in this module writes an audit entry. `ChargeService::find`, `list`, and `listVisits` call no audit method | `Services/ChargeService.php` |
| Every change writes one: `charge.created`, `payment.recorded`, `refund.recorded`, `discount.set` (always, even if repeated), `charge.cancelled` | Same |
| Every change locks the row first, and refuses rather than double-applies: payments above the balance, refunds above the amount paid, and a second active charge are all impossible | Same; backend spec SC-002 |
| **There's no idempotency key.** Two identical payment requests that both fit the balance are both recorded | Same. Nothing in the request carries one |
| Amounts: `numeric`, `decimal:0,2`, `gt:0` (payment, refund), `min:0` (discount), `max:100000`. A string such as `"150"` or `"150.5"` is accepted | `Http/Requests/*` |
| Reasons: `required`, `string`, `max:500` | Same |
| `GET /charges`: `from`, `to` required, `to` after or equal to `from`, at most 92 days (shared with appointments), newest first by `date` then `id` | `ListChargesRequest`, `EloquentChargeRepository` |
| `GET /visits`: `date` required, ordered by doctor id, then queue order. Left visits only with an active charge | `ListVisitChargesRequest`, repository |
| Refusal keys: `visit` (`visit_left`, `already_charged`, `no_fee`), `amount` (`above_balance`, `above_paid`, `discount_too_large`), `charge` (`charge_cancelled`, `money_held`), plus field keys `method` and `reason` | Contract and service |
| Doctors are refused on every route with `403` | Contract; `ChargePolicy` |

## R1. How Billing reads

**Decision:** Billing reads in the browser, through `useLiveList`. While it shows the clinic's today, it uses the existing `live` policy.
For any other date it uses a new `onDemand` policy, which reads when the page opens, when a choice changes, after an action, and on
**Refresh**, and never by itself: no interval, no reading on focus or reconnect.

**Rationale:** The owner chose live reading for today only (clarification 1). One component with two policies keeps one table, one set of
states, and one way of refreshing after an action. `GET /visits` is unaudited, which ADR 0013 requires of anything that reads by itself.

"Today" is the clinic's today, computed on the server from `CLINIC_TIMEZONE`, as every default date is (architecture, Clinic time). A page
left open past midnight keeps reading the date it opened with, which is shown in the filter. That's correct, as it is the date on screen.

**Alternatives:** A server read for other dates, as ADR 0011 does elsewhere, would mean two ways of reading one table, switched by the date.
`router.refresh()` on a timer was rejected for the queue in ADR 0013 for reasons that apply here unchanged.

## R2. The live pieces move out of the queue

**Decision:** Billing is the second real consumer of Phase 7's live reading, so the parts it needs move to shared places (constitution IV):

| From `features/queue` | To | Change |
|---|---|---|
| `hooks/use-live-list.ts` | `lib/api/use-live-list.ts` | Takes a `rootKey`, which `refresh` invalidates, and a `policy`, `live` by default |
| `components/live-query-provider.tsx` | `components/shared/live/live-query-provider.tsx` | None |
| `components/last-read.tsx` | `components/shared/live/last-read.tsx` | Messages move from `queue.lastRead` to `shared.lastRead` |
| `hooks/use-keep-focus.ts` | `lib/use-keep-focus.ts` | None |
| `group-by-doctor.ts` | `lib/group-by-doctor.ts` | Generic over any row with a `doctor.id` |

`lib/api/live-query.ts` gains `ON_DEMAND_QUERY` beside `LIVE_QUERY`. The queue keeps its own root key, `["queue"]`, and Billing uses
`["billing"]`, so an action on one never refreshes the other. Their tests move with them, unchanged except for names.

**Rationale:** Billing needs the same guarantees the queue's lists earned in Phase 7: nothing read on a hidden tab or page, the last list
kept on a failed refresh, and focus kept. Copying them would split one measured behavior in two.

**Alternatives:** Importing them through `features/queue/public.ts` would make Billing depend on the queue's internals and refresh the
queue's root key.

## R3. How Charges and a charge read

**Decision:** Charges and a charge's page read on the server, and actions call `router.refresh()` afterwards, under ADR 0011, as
appointments do. No query provider on either.

**Rationale:** Neither is audited, and neither reads by itself (clarification 1). This is the project's ordinary pattern. After a money
action the refresh reads the charge again, so the page shows the charge as the API now has it (FR-012). The action's own answer gives the
confirmation's wording (the amount and method recorded), so the message can't describe a newer state than the one this person caused.

**Alternatives:** Putting the action's answer on screen directly, then refreshing, would show the same data twice in a row for no gain.

## R4. A money action is sent once

**Decision:**

- Every money action goes through `useFormSubmit` or the dialog's own guard, which allow one request at a time, and through `browserApi`,
  which never retries a mutation. The submit and confirm buttons are disabled while a request is in flight.
- When the outcome is unknown (`isOutcomeUnknown`: no response, or `502` and above), nothing is sent again. The dialog closes, the page
  refreshes, and a notice above the payments says the action may have been recorded and to check the list below before trying again. The
  form keeps what was typed, and sending again needs the confirmation again.
- A `500` is a definite failure, as the API defines it, and shows as one.

**Rationale:** The backend has no idempotency key, so a resent payment that fits the balance is recorded twice. This is the one way this
phase could create a false financial record (FR-013, SC-002).

**Alternatives:** An automatic re-read to decide whether the payment landed can't tell two equal payments apart, so it would mislead. The
person, looking at the list, can.

## R5. Refusals and a charge that changed

**Decision:** A `422` on a money action shows the API's messages on `amount`, `method`, and `reason`, and anything else (`charge`, `visit`)
at form level, then calls `router.refresh()`, as the refusal usually means the charge changed (FR-014). A `403` or `404` refreshes, so the
gate or the page re-decides (the existing `useFormSubmit` behavior).

On Billing, a refused "Charge visit" shows its message in a notice above the list, naming the patient, and refreshes the list. The notice
sits above the rows because the refresh can change or remove the row it's about (ADR 0013).

Error keys are matched only as field names, never by message text, and the `422` reason words (`above_balance` and the rest) never reach
the wire, as `docs/backend-integration.md` records.

## R6. Amounts on the way in

**Decision:** A shared module, `lib/format/amount.ts`, replaces `isValidFeeAmount` in `features/fees`, which becomes its first user:

- `normalizeAmount(text)`: Western digits and the dot, trimmed (the existing `toWesternDecimal`).
- `isAmount(text, { allowZero })`: at most two decimals, at most 100000, above zero unless `allowZero`. On the text, as fees do now.
- `compareAmounts(a, b)`: compares two amounts as whole piastres built from their digits, with no floating-point number at any step.

Payment and refund forms check the amount against the balance or the amount paid before sending, as faster feedback only. The API decides
(FR-015). The amount is sent as the normalized string.

**Rationale:** Constitution V. Comparing to the balance needs ordering, and the fees' check only needed a range. Fees and payments now share
one rule set, so it moves to `lib/format`, the one place money is handled.

## R7. The payment form

**Decision:**

- The amount starts as the full balance (clarification 2). The method has **no default**: one of cash, card, or wallet must be chosen, so
  the method recorded is always one somebody picked.
- Submitting checks the fields, then opens the confirmation, which names the patient, amount, and method and says a payment can't be edited
  or removed. Only confirming sends.
- After success, the form resets to the new balance, and isn't shown at all when nothing is owed.
- When "Charge visit" opens the charge's page, focus goes to the payment form's heading, so the next keystrokes are in the right place.

**Rationale:** SC-001 asks for under 30 seconds. With the balance filled in, a full payment is method, submit, and confirm. Picking a method
is one click, and a preselected one would be recorded wrongly whenever nobody looked.

**Alternatives:** Defaulting to cash, the common case, was rejected because a payment can't be edited afterwards.

## R8. Discount, refund, and cancel

**Decision:**

| Action | Who sees it | When offered | Confirmation | Form |
|---|---|---|---|---|
| Set discount | `discountAndRefund` | Active charge | None: it can be replaced, and the API records each one | Amount (zero allowed), starting from the current discount, and a reason |
| Record refund | `discountAndRefund` | Active, amount paid above zero | Yes, permanent | Amount, method (no default), reason |
| Cancel charge | `billing` | Active, amount paid zero | Yes, can't be undone, the visit can be charged again | Reason, in the dialog |

What's offered is decided by one pure function, `offeredChargeActions(charge, role)`, from the charge's status and amounts as the API sent
them, compared with `compareAmounts`. The API still decides each action. Every reason field says not to enter medical details, allows 500
characters, and uses `dir="auto"`.

## R9. Charges' filters and the patient's page

**Decision:**

- The range defaults to the last 7 days, the clinic's today and the six before it (clarification 4), resolved on the server. One date alone
  means that day, as in appointments.
- A range over 92 days or ending before its start is shown as a message on the range, and **no read is made**. The API's `422` is still
  shown if it refuses anyway.
- The patient filter is Phase 6's `AppointmentPatientFilter`, which now has a second consumer. It moves to `features/patients` as
  `PatientFilter`, exported from `public.ts`, with its messages under `patients.filter`. Appointments use it from there. It reads through
  the unaudited list, so showing the chosen patient writes no opening.
- The patient's page gains "Charges" for `billing`, linking to `/charges?patient_id=N` (clarification 5), with no prefetch.

## R10. Navigation, gates, and roles

`billing` and `discountAndRefund` already exist in `lib/auth/permissions.ts`, transcribed in Phase 3. `billing` and `charges` already exist
in `APP_ROUTES` with `built: false`, and become `built: true`. A charge's page, `/charges/[id]`, uses the `charges` gate. Every page uses
`ScreenGate`, so a doctor gets the forbidden state without any read of billing data. Administrator actions use `useRole()` and `can()`, and
the API's `403` wins.

## R11. Testing

- **Unit:** amounts (including 100 small part payments compared without drift, and the edges `0.01`, `99999.99`, `100000.00`), the
  offered-actions function, filters from the address, the range check.
- **Component:** every state of every screen, field and form-level errors, unknown outcomes, and that a second click sends nothing.
- **End to end, fake backend:** the fake backend gains the payments module, with the same statuses and error keys. Billing's live behavior
  reuses the queue's clock-based tests. Every role on every screen. Axe on every new screen, in both directions.
- **Live:** charge, part-pay, pay, discount, refund, and cancel against the Docker API, with audit counts: one entry per change and none for
  any read, and no `patient.opened` anywhere in the journey. Undoing a check-in with an active charge is refused with the API's message.
