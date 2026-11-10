# Tasks: Billing and Payments

**Input**: Design documents from `specs/009-billing-payments/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/api-usage.md](contracts/api-usage.md), [contracts/screens.md](contracts/screens.md), [quickstart.md](quickstart.md), [ADR 0015](../../docs/decisions/0015-live-reads-beyond-the-queue.md)

**Tests**: Required by the constitution (VIII) and the guidelines' testing table. Within a story, tests come first and must fail before the code that satisfies them is written.

**Organization**: By user story, in the plan's order of work rather than number order. The moves come first and alone, so that a regression shows in the feature it came from. Then a charge's page (US3), because every money action lives on it, then payments (US2), Billing (US1), cancelling (US5), discounts (US6), refunds (US7), and Charges (US4).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: The user story a task belongs to

## Rules for every task

- Check each API detail in [contracts/api-usage.md](contracts/api-usage.md) and `contracts/payments.openapi.yaml`. Never invent one.
- All text goes in both `src/messages/en.json` and `src/messages/ar.json`, with identical keys.
- **Money is a string from the API to the screen.** Never `Number()`, `parseFloat()`, `+value`, or arithmetic on an amount. Typed amounts go through `lib/format/amount.ts`. Nothing shown is computed: fee, discount, amount due, amount paid, and balance are the API's.
- **A money action is sent once.** Never retried, never resent after an unknown outcome, and guarded against a second click (research R4).
- **Only `GET /visits` joins the live reads** (ADR 0015). Nothing audited ever reads by itself.
- **Never call `GET /patients/{id}` to show a patient.** Links to a record use only `PatientLink`. Every other link uses `prefetch={false}`.
- **Reasons, amounts, and patient details never go in an address, title, log, or browser storage.** Patients, doctors, and charges appear in addresses only as numbers.
- **Branch only on status and the error's field key.** Never compare message text. Refusal words such as `above_balance` are never on the wire.
- **Clinic dates are shown as sent.** Instants go through `Instant`, in the clinic's zone.
- **Other features are used only through `public.ts`**, except that `app/` pages may import a feature's server read.
- Response bodies are checked by Zod schemas with `satisfies z.ZodType<Generated>`.
- Logical CSS only. No `any`. Test data is synthetic, including reasons, which read plainly as synthetic.
- Tests use role queries. `getByLabel` needs `.locator("visible=true")` after a soft navigation, as hidden pages stay in the DOM.

---

## Phase 1: Setup

- [X] T001 Confirm that `pnpm check` passes on the branch before any change, and record the observed result in this file. If anything fails, stop and report it rather than working around it. **Observed on 2026-11-08, before any change:** typecheck, lint, format, i18n, styles, contrast, and contracts passed; unit tests 1609 of 1609 passed; e2e 547 passed, then the run was stopped by Claude Code because the computer was low on memory, and from test 548 on the Playwright workers exited with code 3221225794 in 0 ms. Those aren't test failures, and the rest of the e2e suite wasn't observed on the unchanged branch
- [X] T002 Regenerate or confirm `src/lib/api/generated/payments.ts` against `contracts/payments.openapi.yaml` with the project's contract tooling (`pnpm contracts:check`), and confirm it exposes `VisitCharge`, `ChargeSummary`, `Charge`, `Payment`, `Refund`, `PaymentMethod`, and `ChargeStatus`. No change is expected

---

## Phase 2: Foundational (blocks every story)

### Moves, with no change of behavior (ADR 0015, research R2, R6, R9)

Each move lands alone, and the tests of the feature it came from must pass unchanged, apart from import paths and names, before the next.

- [X] T003 Move `src/features/queue/hooks/use-live-list.ts` and its test to `src/lib/api/use-live-list.ts`. It gains a required `rootKey: QueryKey`, which `refresh()` invalidates in place of `QUEUE_ROOT_KEY`, and an optional `policy`, `LIVE_QUERY` by default. The queue passes `["queue"]`. Update every import in `src/features/queue` and `src/features/encounters`. Run the queue's and encounters' unit tests and `e2e/queue.spec.ts`; all must pass unchanged
- [X] T004 Move `src/features/queue/components/live-query-provider.tsx` to `src/components/shared/live/live-query-provider.tsx`, and `src/features/queue/components/last-read.tsx` with its test to `src/components/shared/live/last-read.tsx`. `LastRead`'s messages move from `queue.lastRead` to `shared.lastRead` in both language files, with the same text. Update the imports in `src/app/[locale]/(app)/queue/page.tsx`, `src/app/[locale]/(app)/my/queue/page.tsx`, and the queue's components, and add `shared` to their `ScopedMessages` if it isn't there. Run `pnpm check:i18n`, the queue's tests, and `e2e/queue.spec.ts`
- [X] T005 [P] Move `src/features/queue/hooks/use-keep-focus.ts` and its test to `src/lib/use-keep-focus.ts`, and update imports. The queue's tests must pass unchanged
- [X] T006 [P] Move `src/features/queue/group-by-doctor.ts` and its test to `src/lib/group-by-doctor.ts`, generic over `Row extends { doctor: { id: number } }`, returning `{ doctor: Row["doctor"]; rows: Row[] }[]`. Update the queue's callers. Add a test with a non-queue row shape. Adjacent rows only, the API's order kept, never sorted
- [X] T007 Write failing tests in `src/lib/format/amount.test.ts`, then add `src/lib/format/amount.ts`: `normalizeAmount(text)` (through `toWesternDecimal`, then trimmed); `isAmount(text, { allowZero })` (`^\d+(\.\d{1,2})?$`, at most `100000`, above zero unless `allowZero`), moved from `isValidFeeAmount`; and `compareAmounts(a, b)` returning `-1 | 0 | 1`, by building whole piastres from the digits as strings or `BigInt`, **with no floating-point step**. Cases from quickstart: `0.01`, `99999.99`, `100000.00` accepted; `0`, `0.001`, `100000.01`, `-1`, `1e3`, `""` refused; zero only when allowed; Arabic-Indic digits and `٫` normalized; `9.99` against `10.00`; `"150"` equals `"150.00"`; and 100 payments of `0.01` against `1.00` compared by repeated comparison only, the 100th fitting and a 101st not. Then make `src/features/fees/schemas/fee.ts` use `isAmount`, removing `isValidFeeAmount`; `fee.test.ts` and `fee-form.test.tsx` must pass unchanged in what they assert
- [X] T008 Move `src/features/appointments/components/appointment-patient-filter.tsx` to `src/features/patients/components/patient-filter.tsx` as `PatientFilter`, exported from `src/features/patients/public.ts`. Its messages move from `appointments.patientFilter` to `patients.filter` in both language files, with the same text. It keeps clearing `from`, `to`, and `page` when the patient changes. Update `src/app/[locale]/(app)/appointments/page.tsx`. Add `src/features/patients/components/patient-filter.test.tsx` if none exists, covering choose, clear, and an id that isn't valid, with zero `GET /patients/{id}`. Run the appointments' unit tests and `e2e/appointments.spec.ts`
- [X] T009 Write failing tests in `src/lib/api/live-query.test.ts`, then add `ON_DEMAND_QUERY` to `src/lib/api/live-query.ts`: `staleTime` 0, `refetchInterval` false, `refetchOnWindowFocus` false, `refetchOnReconnect` false, `networkMode` "always", `retry: retryLiveRead`. Its comment names ADR 0015, and says it never reads by itself

### Billing logic

- [X] T010 [P] Write failing tests, then add `src/features/billing/types.ts` over `src/lib/api/generated/payments.ts`, and `src/features/billing/schemas/billing.ts` with its test: response schemas for `VisitCharge`, `ChargeSummary`, `Charge` (with `Payment` and `Refund`), using `satisfies z.ZodType<Generated>`, and pages with `meta` following `src/lib/api/pagination.ts`. Money fields match `^\d+\.\d{2}$`; `balance` and `charge_id` are nullable on a visit; `visit_id` is nullable on a charge; `charge_status` is one of `none`, `unpaid`, `partially_paid`, `paid`; `status` one of `unpaid`, `partially_paid`, `paid`, `cancelled`; `method` one of `cash`, `card`, `wallet`
- [X] T011 [P] Write failing tests, then implement `src/features/billing/offered-charge-actions.ts` with its test, exactly as data-model's table: `pay` when not `cancelled` and `balance` above `0.00`, for `billing`; `cancel` when not `cancelled` and `amount_paid` is `0.00`, for `billing`; `discount` when not `cancelled`, for `discountAndRefund`; `refund` when not `cancelled` and `amount_paid` above `0.00`, for `discountAndRefund`. Uses `compareAmounts` and `can()`. Nothing on a cancelled charge. Cover administrator and receptionist on each status, a whole-fee discount (paid, amount paid `0.00`), and a doctor, who gets nothing
- [X] T012 [P] Write failing tests, then implement `src/features/billing/read-billing-filters.ts` with its test: `date` only if `YYYY-MM-DD`, else the clinic's today passed in; `doctor_id` through `readPositiveId`; `charge_status` only if one of `none`, `unpaid`, `partially_paid`, `paid`; `page` a positive whole number, else 1. Returns also `isToday`. Nothing throws
- [X] T013 [P] Write failing tests, then implement `src/features/billing/read-charge-filters.ts` with its test: `from` and `to` as `YYYY-MM-DD`, one alone meaning that day, neither meaning six days before the clinic's today through today (using `addDays` from `src/lib/format/clinic-today.ts`); `patient_id`, `doctor_id` through `readPositiveId`; `status` one of `unpaid`, `partially_paid`, `paid`, `cancelled`; `page`. Returns `rangeProblem: "too_long" | "reversed" | null`, with `too_long` for more than 92 days including both ends. Cover 92 days (allowed), 93 (refused), a reversed range, and a month boundary

### API modules

- [X] T014 Write failing tests, then implement `src/features/billing/api/billing.ts` with `billing.test.ts`, through `browserApi`: `readVisits(filters, locale)`, always with `per_page=100` and only the filters set; `chargeVisit(visitId, locale)`, sending no body; `recordPayment(chargeId, { amount, method }, locale)`; `recordRefund(chargeId, { amount, method, reason }, locale)`; `setDiscount(chargeId, { amount, reason }, locale)` as `PUT`; `cancelCharge(chargeId, { reason }, locale)`. Each answer checked with the schemas and unwrapped from `data`. Amounts are sent as the normalized strings. Assert that no function retries
- [X] T015 Write failing tests, then implement `src/features/billing/api/charges-server.ts` with `server-only`, through `serverApi()`, following `src/features/appointments/api/appointments-server.ts`: `readCharges(locale, filters)` and `readCharge(locale, id)`, each `no-store` after `connection()`, with schema checks

### Fake backend and live setup

- [X] T016 Extend `e2e/support/fake-clinic.mjs` with the payments module, following its existing style: the eight operations in contracts/api-usage.md, keyed to its queue entries and fees. Charges keep the fee at charging; amounts are kept as strings and computed in whole piastres; statuses follow data-model's states. It answers `422` under `visit`, `amount`, `method`, `reason`, and `charge` as the real API does, `403` for doctors on every route and for receptionists on refunds and discounts, `404` for unknown ids, and `422` on `entry` for undoing a check-in with an active charge (already present: make it follow real charges). Ranges over 92 days are refused under `to`. A test can seed visits and charges, make a chosen call fail with a status or with no response after recording it (to test unknown outcomes), change a charge between reads, and read a count of each operation and of `GET /patients/{id}`
- [X] T017 Add a dedicated synthetic doctor with a fee and hours on all seven days to `e2e/live/setup.ts`, with its account in the `LiveAccounts` type in `e2e/live/support.ts`, deactivated by teardown as the others are: `billingDoctor`

**Checkpoint**: `pnpm check` passes, with the queue, encounters, fees, and appointments behaving exactly as before. **Observed on 2026-11-08 after the moves:** typecheck, lint, format, i18n, and styles passed; unit tests in the moved and affected features passed; on a production build, `e2e/queue.spec.ts`, `encounters.spec.ts`, `appointments.spec.ts`, and `fees.spec.ts` gave 217 passed and 1 failed, "a time no longer offered is refused on the free times", a 30-second timeout clicking the doctor chooser, which no move touches. Run alone three times, it passed 3 of 3 in about 2 seconds each, so it was taken as a timing flake under load

---

## Phase 3: Access, for every story

- [X] T018 Add page shells with `ScreenGate`, `Suspense`, `PageHeader`, and `ScopedMessages`, following `src/app/[locale]/(app)/queue/page.tsx`: `src/app/[locale]/(app)/billing/page.tsx` with path `billing`, `src/app/[locale]/(app)/charges/page.tsx` and `src/app/[locale]/(app)/charges/[id]/page.tsx` with path `charges`. Set `built: true` for `billing` and `charges` in `src/lib/auth/app-routes.ts`. Add the `billing.*`, `charges.*`, and `shared.paymentMethod.*` messages used so far to both language files
- [X] T019 Move the "later phases' placeholders are unchanged" check in `e2e/appointments.spec.ts` (and anywhere else that uses `/en/billing` or `/en/charges` as a placeholder) to `/en/reports`, and confirm `session-end`, `token-absence`, `auth`, and `navigation` specs still pass against the real pages, giving the fake backend whatever they now read. Don't weaken any of them
- [X] T020 Create `e2e/billing.spec.ts` with role cases on the fake backend: a doctor has no Billing or Charges in the navigation and gets "not allowed" on `/billing`, `/charges`, and `/charges/1` with zero billing reads; administrators and receptionists open all three (FR-001, FR-002, SC-004)

---

## Phase 4: User Story 3 - See one charge in full (Priority: P1)

**Goal**: Anyone at the desk opens a charge and sees what was charged, paid, and by whom.

**Independent Test**: Open a charge with two payments, a discount, and a refund; every value matches the API's; a reload writes no audit entry.

- [X] T021 [US3] Write failing tests in `src/features/billing/components/charge-view.test.tsx`, then implement `charge-view.tsx`: status with `StatusBadge` kind `charge`; clinic date as sent; doctor; patient number, name as `PatientLink`, and phone in `LtrText`; charged by and `charged_at` as `Instant`; fee, discount, amount due, amount paid, and balance through `Money`; the discount's reason (`UserText`, `dir="auto"`), by, and when; payments then refunds in the API's order, each with amount, method from `shared.paymentMethod`, `Instant`, staff name, and the refund's reason. Cancelled: reason, by, when, no actions, and "This visit no longer exists" when `visit_id` is null. A slot for the actions `offeredChargeActions` gives, filled by later stories (FR-007, FR-017, FR-018)
- [X] T022 [US3] Complete `src/app/[locale]/(app)/charges/[id]/page.tsx`: an id that isn't a positive whole number gives the neutral not-found state with no read; otherwise `readCharge`, with `ApiFailureState` for `403` and `404` (neutral, with a link to Charges) and an error state with "Try again" for other failures
- [X] T023 [US3] Add to `e2e/billing.spec.ts`: every field of a seeded charge with payments, a discount, and a refund, in both languages, with amounts matching the fake's strings exactly; a cancelled charge, with and without its visit; a charge that doesn't exist and an id that isn't valid; zero reads of the charge from hovering a link to it, and zero `GET /patients/{id}` unless the name is followed (FR-019)

---

## Phase 5: User Story 2 - Record a payment (Priority: P1)

**Goal**: Reception records all or part of what's owed, confirmed first, sent once.

**Independent Test**: Pay part in cash, then the rest by card; partially paid, then paid, with the form gone.

- [X] T024 [US2] Write failing tests in `src/features/billing/components/payment-form.test.tsx`, then implement `payment-form.tsx` with React Hook Form and `useFormSubmit`, fields `amount` and `method`: amount starting as the charge's `balance`; method a radio group of `cash`, `card`, `wallet` with **none chosen**; checks before sending through `isAmount` and `compareAmounts` against `balance`, with messages on each field; submit opens a `ConfirmDialog` naming the patient, amount (`Money` of the normalized value), and method, saying a payment can't be edited or removed, opening on the safe choice; only confirming calls `recordPayment`. On success: close, toast stating the amount and method from the API's answer, reset to the new balance, `router.refresh()`. On `422`: messages on `amount` and `method`, others at form level, then `router.refresh()`. Repeated clicks send one request (FR-008, FR-015, FR-016, research R7)
- [X] T025 [US2] Write failing tests in `src/features/billing/components/outcome-unknown-notice.test.tsx`, then implement `outcome-unknown-notice.tsx`, and use it from `payment-form.tsx`: when `isOutcomeUnknown(error)`, the dialog closes, nothing is resent, `router.refresh()` is called, what was typed is kept, and a notice above the payments, announced once as a status, says the payment may have been recorded and to check the list below before trying again. It clears on the next successful action. A `500` shows as a plain failure (FR-013, research R4)
- [X] T026 [US2] Put `PaymentForm` in `charge-view.tsx` when `pay` is offered, with focus moved to its heading when the address carries `?charged=1` (set by US1), then removed from the address with `router.replace` so a reload doesn't repeat it
- [X] T027 [US2] Add to `e2e/billing.spec.ts`: part in cash then the rest by card, with statuses, balance, and the form gone; an amount above the balance caught with no request, then forced and refused by the fake with the message on `amount`; no method chosen; the charge cancelled elsewhere between read and confirm, giving the API's message and a fresh charge; no answer after the fake records the payment, giving one request only, the notice, and the payment visible after the refresh; `502`; a double click on confirm sending one request; Arabic digits typed and sent as Western (SC-002, SC-003)

---

## Phase 6: User Story 1 - Charge a visit at the desk (Priority: P1)

**Goal**: Billing lists a date's visits with what each owes, and charges one at the doctor's fee.

**Independent Test**: Check in a patient, charge from Billing, land on the charge's page ready to pay.

- [X] T028 [US1] Write failing tests in `src/features/billing/components/billing-group.test.tsx`, then implement `billing-group.tsx`, following `src/features/queue/components/queue-group.tsx`: the doctor's name as heading; each row with patient number, `PatientLink`, phone in `LtrText`, queue status (`StatusBadge` kind `queue`), "walk-in" where it applies, charge status (kind `charge`), balance through `Money` or `NoValue`; "Charge visit" when `charge_status` is `none`, else a link to `/charges/{charge_id}` with `prefetch={false}`. A busy row's button is disabled; the others aren't
- [X] T029 [US1] Write failing tests in `src/features/billing/components/billing-list.test.tsx`, then implement `billing-list.tsx`, following `clinic-queue.tsx`: `useLiveList` with `rootKey` `["billing"]`, query key `["billing", filters]`, and `LIVE_QUERY` when `isToday`, else `ON_DEMAND_QUERY`; `FilterBar` with date, doctor (inactive labelled), and charge status, all in the address; `groupByDoctor`; `LastRead` (the time and "may be out of date" only when today; "Refresh" always); `useKeepFocus`; states from contracts/screens.md, including both empty states and a link to the queue when the date is today; a `403` clears the list and stops; a page beyond the end replaced with the last page. Charging: `chargeVisit`, one at a time; on success, a toast with the amount charged and `router.push("/charges/{id}?charged=1")`; on refusal, a notice above the list naming the patient with the API's messages (`allMessages`), and `refresh()`; on an unknown outcome, the same notice saying it may have been charged, and `refresh()` (FR-003, FR-003a, FR-004, FR-005, research R5)
- [X] T030 [US1] Complete `src/app/[locale]/(app)/billing/page.tsx`: read the filters with `readBillingFilters` and `clinicToday(getEnv().CLINIC_TIMEZONE)`, read all doctors on the server for the filter (shown with less to filter by if that fails), and render `BillingList` inside `LiveQueryProvider`, with `ScopedMessages` for `billing`, `shared`, and `auth`
- [X] T031 [US1] Add to `e2e/billing.spec.ts`: today's list grouped by doctor in the fake's order; filters and page surviving a reload and the back button; charging and landing on the charge with focus on the payment form; each refusal (`no_fee`, `visit_left`, `already_charged`) as the notice and a fresh list; an unknown outcome; today read once per 15 seconds on Playwright's clock, none on a hidden tab or another page, and a failed refresh keeping the list with its notice; another date read once on opening and on "Refresh", and not on the clock, focus, or reconnect; addresses holding only the date, ids, and status (FR-020)

**Checkpoint**: Phases 1 to 6 are the smallest useful slice: charge a visit and take its payment.

---

## Phase 7: User Story 5 - Cancel a mistaken charge (Priority: P2)

**Goal**: A charge with no money held is cancelled with a reason, and the visit can be charged again.

**Independent Test**: Charge, cancel with a reason, and see "Charge visit" offered again on Billing.

- [X] T032 [US5] Write failing tests in `src/features/billing/components/cancel-charge.test.tsx`, then implement `cancel-charge.tsx`: a button opening a `ConfirmDialog` holding a reason field (required, at most 500 characters, `dir="auto"`, hint "don't enter medical details"), saying cancelling can't be undone and the visit can be charged again, opening on the safe choice. Confirming calls `cancelCharge` once; success toasts and `router.refresh()`; `422` on `reason` on the field, on `charge` (`money_held`, already cancelled) at form level, then `router.refresh()`; an unknown outcome closes the dialog and shows the notice (FR-009, research R8)
- [X] T033 [US5] Offer `CancelCharge` from `charge-view.tsx` when `cancel` is offered
- [X] T034 [US5] Add to `e2e/billing.spec.ts`: cancelling with a synthetic reason, the cancelled state, and Billing offering "Charge visit" again; money received elsewhere first, giving the API's message and a fresh charge; no reason; 501 characters; undoing a check-in of a charged visit on `/queue` showing the API's message, then succeeding once the charge is cancelled

---

## Phase 8: User Story 6 - An administrator gives a discount (Priority: P3)

**Goal**: An administrator sets, replaces, or removes a discount with a reason.

**Independent Test**: Discount an unpaid charge, then the whole fee, giving paid. A receptionist sees no discount action.

- [X] T035 [US6] Write failing tests in `src/features/billing/components/discount-form.test.tsx`, then implement `discount-form.tsx` with `useFormSubmit`, fields `amount` and `reason`: amount starting as the current `discount`; `isAmount` with zero allowed; a reason (required, at most 500 characters, `dir="auto"`, hint "don't enter medical details"); text saying saving replaces the discount and zero removes it; no confirmation. Calls `setDiscount` once; success toasts and `router.refresh()`; `422` on `amount` (including too large) and `reason` on their fields, `charge` at form level, then `router.refresh()`; an unknown outcome shows the notice (FR-010)
- [X] T036 [US6] Offer `DiscountForm` from `charge-view.tsx` when `discount` is offered, using `useRole()`
- [X] T037 [US6] Add to `e2e/billing.spec.ts`: an administrator's discount lowering amount due and balance with the fee unchanged; a whole-fee discount giving paid; zero removing it; too large refused on `amount`; a receptionist offered no discount, and a forced one answered `403` and shown as a refusal

---

## Phase 9: User Story 7 - An administrator records a refund (Priority: P3)

**Goal**: An administrator records money returned, confirmed first, sent once.

**Independent Test**: Refund part of a paid charge; amount paid falls, balance rises, the payment is unchanged.

- [X] T038 [US7] Write failing tests in `src/features/billing/components/refund-form.test.tsx`, then implement `refund-form.tsx`, following `payment-form.tsx`: amount (empty), method with none chosen, reason (required, at most 500 characters, `dir="auto"`, hint "don't enter medical details"); checks with `isAmount` and `compareAmounts` against `amount_paid`; a confirmation naming the patient, amount, and method and saying a refund can't be edited or removed; sent once; refusals and unknown outcomes as for payments (FR-011, FR-013)
- [X] T039 [US7] Offer `RefundForm` from `charge-view.tsx` when `refund` is offered, using `useRole()`
- [X] T040 [US7] Add to `e2e/billing.spec.ts`: a part refund with its reason shown and the payment unchanged; above the amount paid caught, then forced and refused on `amount`; an unknown outcome with one request only; a receptionist offered no refund, and a forced one answered `403`

---

## Phase 10: User Story 4 - Find charges and what is owed (Priority: P2)

**Goal**: Find charges over a range by patient, doctor, and status, and reach them from a patient's page.

**Independent Test**: Filter seeded charges by each choice; a range over 92 days is caught with no read.

- [X] T041 [US4] Write failing tests in `src/features/billing/components/charge-list.test.tsx`, then implement `charge-list.tsx` with `DataTable`: each row with date as sent, status, doctor, patient number, name as `PatientLink`, phone, fee, discount, amount due, amount paid, balance, and a link to the charge with `prefetch={false}`; paging below; both empty states; a `422` shown with the filters; the range problem shown as a message with no list (FR-006)
- [X] T042 [US4] Complete `src/app/[locale]/(app)/charges/page.tsx`: filters with `readChargeFilters`; **no `readCharges` call when `rangeProblem` is set**; doctors for the filter; `FilterBar` with from, to, doctor, and status; `PatientFilter` from `src/features/patients/public.ts` beside it, keyed by `patient_id`
- [X] T043 [US4] Write a failing test in `src/features/patients/components/patient-record.test.tsx`, then add "Charges" to `patient-record.tsx` for `billing`, linking to `/charges?patient_id=N` with `prefetch={false}`, causing no further read of the record (FR-006a)
- [X] T044 [US4] Add to `e2e/billing.spec.ts`: the default last 7 days, newest first; each filter, surviving a reload and the back button; one date alone; 93 days and a reversed range caught with zero `GET /charges`; the API's `422` when forced; "Charges" from a patient's page with the patient chosen and zero further `GET /patients/{id}`; no search term in the address, title, or browser storage

---

## Phase 11: Polish and cross-cutting

- [X] T045 Add `/billing` (today and another date), `/charges`, and `/charges/[id]` with each form and dialog open, the refusal notice, and the unknown-outcome notice to `e2e/accessibility.spec.ts`, in both languages and directions and both themes wherever the other screens check them. Fix what it finds (SC-005)
- [X] T046 Write `e2e/live/billing.spec.ts`, covering every row of quickstart's live table against the running API with `billingDoctor` and synthetic patients, with audit counts read through `GET /audit-entries` and its own entries counted out: no entry for any read or reload; one `charge.created`, two `payment.recorded`, one `discount.set`, one `refund.recorded`, one `charge.cancelled`; undo of a charged check-in refused; a receptionist's forced refund `403`; no `patient.opened` unless a name was followed, then exactly one (SC-002, SC-006)
- [X] T047 Add to the live journey a search of the address history and browser storage for every synthetic reason, amount typed, and patient detail used, as earlier live suites do (FR-020, SC-006)
- [X] T048 Confirm that no key is missing from either language file, no user-facing text is hard-coded, only logical CSS is used, and no amount is converted to a number anywhere in `src/features/billing` and `src/lib/format/amount.ts` (search for `Number(`, `parseFloat`, `parseInt`, and unary `+` on amounts), using the project's checks and a search
- [X] T049 [P] Update `docs/backend-integration.md` with what the live suite confirmed about payments, only as observed, and add **hazard H6**: no idempotency key on money actions, so a resent payment that fits the balance is recorded twice, and how the frontend guards against it
- [X] T050 [P] Update `docs/architecture.md` ("A list that stays current" naming Billing and the shared places; the billing feature; "a money action is sent once"), and link `docs/decisions/0013-live-reads.md` to ADR 0015
- [X] T051 [P] Update `docs/frontend-blueprint.md` with Billing, Charges, and a charge's page as built and the patient page's link, and `docs/development-guidelines.md` with money input through `lib/format/amount.ts` and how a money action handles an unknown outcome
**Progress note (2026-11-08):** T019, T020, T023, T027, T031, T034, T037, T040, T044, T045, T046, and T047 are written but not yet
observed passing. The first run of `e2e/billing.spec.ts` on a production build was stopped by Claude Code after 15 of 43 tests,
because the computer was low on memory. Of those 15, tests 1 to 10 passed, and 11 to 14 timed out: three on `check()` of a payment
method, which was a fault in the tests (the radio is visually hidden inside its label, so the click landed on the label), now fixed
by clicking the label, and one on an assertion the page snapshot shows should hold, which wasn't reproduced.

**The owner's `pnpm test:e2e` (2026-11-08):** 901 passed and 9 failed, in 27.5 minutes, all nine in this phase's new tests, none in the
application: queries matching two fields because the payment and refund forms share "Method" and "Amount", and the refund and
discount forms share "Reason" (5); the accessibility check measuring buttons while the page refreshed after an unknown outcome (2); a
forced request without `Accept: application/json`, which the proxy answers with `406` (1); and the patient page's "Charges" link
sharing its name with the navigation's (1). Each was fixed in the tests, by scoping to the form's section, waiting for the refresh,
sending the header, and looking within the page.

**The owner's run of `e2e/billing.spec.ts` and `e2e/accessibility.spec.ts` (2026-11-08):** 207 passed and 2 failed, in 12.4 minutes:
"a 502 is an unknown outcome too" and "a discount too large is refused on the amount". Both page snapshots show the same cause, in
the tests: text typed before the page had hydrated landed in front of the value React then gave the field (`"350.0010"`,
`"0.00300"`), so the check before sending refused it, as it should. The application can't send early, as each form's button stays
disabled until hydration. Fixed by `openCharge`, which waits for no submit button to be disabled before typing.

**Then, in this session (2026-11-08), on a fresh production build:** `e2e/billing.spec.ts` first failed every charge-page test with a
stack overflow, as the bulk change to `openCharge` had made it call itself; corrected, it gave 43 of 43. The live billing suite gave 5
of 6: an earlier Billing page, still mounted but hidden, also has a "Balance" label, so `fact` now looks only at what's visible; then
6 of 6, and `e2e/billing.spec.ts` again 43 of 43.

- [X] T052 Run `pnpm check` and `pnpm test:e2e:live`, record the actual results in this file and `docs/roadmap.md`'s phase line, and don't report anything not observed. List the quickstart checks that can't be done in this environment for the owner, including timing SC-001 by hand **Result (2026-11-08):** typecheck, lint, format, i18n, styles, contrast, and contracts passed; unit tests 1797 of 1797. End to end, the
  owner's `pnpm test:e2e` gave 901 passed with 9 failed in this phase's new tests; after the fixes above, the owner's run of
  `billing.spec.ts` with `accessibility.spec.ts` gave 207 passed and 2 failed, and this session's runs of `billing.spec.ts` 43 of 43.
  No application code changed after the owner's full run, only these specs, so the full suite wasn't repeated. `pnpm test:e2e:live`
  was run in groups, to stay within this environment's limits: health, auth, patients, clinic setup and operations 51 passed;
  appointments and queue 30 passed; encounters 20 passed; billing 6 passed: 107 of 107. Left for the owner by hand: timing SC-001 at
  the desk, a screen reader through a payment, and keyboard-only use of the method choice
- [X] T053 Run `/code-review` on the phase's changes, fix what's confirmed, and re-run T052's checks. **Result (2026-11-08, medium
  level):** 10 findings. Fixed 8: the payment amount now follows a balance changed by another action on the page, unless an amount
  was typed; a `patient_id` that can't be one reads nothing, rather than everyone's charges under "this patient"; a refusal is kept
  by the page when the refresh it causes removes its form; on-demand Billing no longer says it retries by itself; a charge refusal
  shows only on the list it came from; every "Charge visit" waits while one is sent; the `?charged=1` flag is removed with
  `history.replaceState`, with no second read of the charge; Billing's root key moved to `query-keys.ts`, and the provider's comment
  names Billing. Left 2: a Billing page left open past midnight keeps the date it opened with, as research R1 decided; and the doctor
  filter's options, repeated in three lists including the queue's, weren't merged, to keep the queue unchanged. After the fixes:
  typecheck, lint, format, i18n, styles, contrast, and contracts passed; unit tests 1802 of 1802; on a fresh production build
  `e2e/billing.spec.ts` 43 of 43, the billing and charges screens in `e2e/accessibility.spec.ts` 12 of 12, `e2e/queue.spec.ts`
  66 of 66, and the live billing suite 6 of 6. **Accepted by the owner on 2026-11-08.** The checks by hand weren't done, so they're
  unconfirmed: timing SC-001 at the desk, a screen reader through a payment, and keyboard-only use of the method choice

---

## Dependencies and order

```text
Phase 1 → Phase 2 (moves first, each alone; then logic, API, fake) → Phase 3 (access)
                                                                        │
                                                                        ▼
                                                                  US3 (a charge)
                                                                        │
                                                                        ▼
                                                                  US2 (payment)
                                                                        │
                                                                        ▼
                                                                  US1 (billing)
                                                                        │
                                   ┌──────────────┬───────────────┬─────┴──────────┐
                                   ▼              ▼               ▼                ▼
                                 US5            US6             US7              US4
                              (cancel)      (discount)       (refund)        (charges)
                                   └──────────────┴───────────────┴────────────────┘
                                                          │
                                                          ▼
                                                       Polish
```

- **US3 before US2**: the payment form lives on the charge's page. **US2 before US1**: charging lands on that form, and `?charged=1` is handled there.
- **US5, US6, US7** each add one action to `charge-view.tsx`, so they touch one shared file; do them one after another. **US4** touches none of their files and can run alongside them.
- US7 follows US2's form, and reuses its unknown-outcome handling.
- **The smallest useful slice**: Phases 1 to 6.

## Parallel examples

- Phase 2: T005 and T006 alongside each other, after T003 and T004. T010 to T013 are separate files with no dependency on each other.
- After US1: US4 (T041 to T044) alongside US5, US6, and US7.
- Polish: T049, T050, and T051.

## Implementation strategy

1. Finish Phases 1 and 2, confirming at the checkpoint that every moved piece behaves exactly as before. Stop and report if any can't.
2. Build Phases 3 to 6 for a usable desk slice, running `pnpm check` at the end of each.
3. Add cancelling, discounts, refunds, and Charges, one phase at a time.
4. Run the live suite and review only once all stories are in.
