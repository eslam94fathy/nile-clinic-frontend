# Implementation Plan: Billing and Payments

**Branch**: `009-billing-payments` | **Date**: 2026-11-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/009-billing-payments/spec.md`

## Summary

Build Billing (a date's visits and charging them), Charges (finding charges), and a charge's page (payments, and cancel, discount, and
refund), and add a "Charges" link to the patient's page.

**The main design point is that a money action is sent exactly once.** The backend has no idempotency key, so a resent payment that fits
the balance is recorded twice, and payments can't be edited. Every action is guarded against a second click, never retried, and an unknown
outcome is shown as one, with the charge read again and the person asked to check before trying again (R4).

**The second is that Billing reads by itself for today only.** It reuses Phase 7's live reading, which therefore moves out of
`features/queue` into shared places, and gains an `onDemand` policy for other dates (R1, R2, ADR 0015). Charges and a charge's page read on
the server and refresh after actions, as appointments do (R3).

**The third is that money is never a number.** Amounts are shown as the API's strings, and typed amounts are checked and compared on their
digits as whole piastres, in one shared module that fees now use too (R6).

## Technical Context

**Language/Version**: TypeScript 5.9.3, Node 24, React 19.3.1, Next.js 16.4.5 with Cache Components

**Primary Dependencies**: None new. Uses `@tanstack/react-query` 5.106.1 (ADR 0013), React Hook Form 7.91.0, Zod 4.6.7

**Storage**: None. The query cache is memory only, and is never persisted

**Testing**: Vitest and Testing Library; Playwright with axe against the production build and the fake backend, which gains the payments
module, using Playwright's clock for Billing's 15 seconds; `pnpm test:e2e:live` against the Docker API, with audit counts

**Target Platform**: Modern browsers on desktop and tablet, Chromium tested, as in earlier phases

**Project Type**: Web application, frontend with BFF

**Performance Goals**: Charge and full payment in under 30 seconds of work (SC-001): with the balance filled in, a full payment is a method,
a submit, and a confirm. One read per visible Billing page for today every 15 seconds, and none otherwise. Nothing is prefetched

**Constraints**: Money stays a string. No money action resent. No reason, amount, or patient detail in addresses, titles, logs, or browser
storage; identifiers and dates may appear in an address. Instants in the clinic's time zone. Never compare message text. WCAG 2.2 AA in
both directions

**Scale/Scope**: 3 new pages, 1 new feature (`billing`), 8 API operations of its own plus 4 reused, 3 changed features (`queue`, `fees`,
`appointments` through moved code; `patients` gains a link and the filter), 5 pieces moved to shared places, no new dependency

## Constitution Check

*GATE: Passed before research. Re-checked after design, with the same result.*

| Principle | Status | How |
|---|---|---|
| I. Backend is source of truth | Pass | Every operation, field, filter, and error key checked in the contract and source (research, Facts). Statuses and amounts are the API's; `offeredChargeActions` and the checks before sending only decide what's shown, and the API wins |
| II. Security and privacy | Pass | No read in this module is audited, confirmed in the source and measured by the live suite. Patient links never prefetched. Reasons only on the charge's page, never in addresses or logs. Cache in memory only, cleared by sign-out's and `401`'s full page load. A `403` clears Billing's data |
| III. Role-based UI is UX | Pass | `billing` and `discountAndRefund` already in the role map. `ScreenGate` on each page, so a doctor causes no billing read. Administrator actions hidden by role, and the API's `403` handled on every call |
| IV. Feature-based architecture | Pass | New `features/billing`. The live pieces, the amount rules, and the patient filter each move to a shared place because this phase is their second real consumer. Client Components only for polling and interaction |
| V. Strict typing | Pass | Types from the generated contracts; schemas `satisfies z.ZodType<Generated>`. Money as strings, compared on digits, never a floating-point number |
| VI. Every state designed | Pass | See [contracts/screens.md](contracts/screens.md). Payments, refunds, and cancelling confirm and say they can't be undone or edited. Charging and discounts don't, as each can be corrected, which the owner confirmed for charging |
| VII. Bilingual, accessible | Pass | All text in both files. Statuses and methods translated; names and reasons as written, `dir="auto"`. Amounts isolated in Arabic text. Refreshes aren't announced. Axe on every new screen and dialog |
| VIII. Tested before done | Pass | See [quickstart.md](quickstart.md), including every role, unknown outcomes, and audit counts |
| IX. Simplicity | Pass | No new dependency. Each moved piece has a real second consumer. One new policy, used |
| X. Spec-driven | Pass | Full cycle, with five clarifications. ADR 0015 records the extension of ADR 0013, accepted by the owner |

## Order of Work

1. **Moves, with no change of behavior.** The live pieces, `groupByDoctor`, the amount rules, and the patient filter, each to its shared
   place. The queue's, fees', and appointments' tests must pass unchanged before anything is built on them.
2. **Foundations.** Types and schemas, the API module, `offeredChargeActions`, filters from the address, the `onDemand` policy, and the fake
   backend's payments module.
3. **Page shells and access.** All three pages with `ScreenGate`, `built: true`, and messages. Role access can be tested from here on.
4. **A charge's page, read only.** Every field and state, including cancelled.
5. **Record payment**, with the confirmation, refusals, and unknown outcomes. The most important flow, so it comes first among actions.
6. **Billing.** The list, live today and on demand otherwise, and charging.
7. **Cancel**, then **discount** and **refund** for administrators.
8. **Charges**, with the patient filter, and the patient's page link.
9. **Live journey, accessibility, documents.**

## Project Structure

### Documentation (this feature)

```text
specs/009-billing-payments/
├── spec.md
├── plan.md                  # This file
├── research.md              # Findings and decisions
├── data-model.md            # Entities, states, offered actions, filters, and form rules
├── quickstart.md            # How to validate, including the live journey
├── contracts/
│   ├── api-usage.md         # API operations, audit effect, and error keys
│   └── screens.md           # Each screen's states
├── checklists/requirements.md
└── tasks.md                 # Next step: /speckit-tasks
```

### Source Code

```text
src/
├── app/[locale]/(app)/
│   ├── billing/page.tsx                    # Gate, date and filters from the address, doctors, BillingList in the provider
│   └── charges/
│       ├── page.tsx                        # Gate, range and filters, server read, PatientFilter
│       └── [id]/page.tsx                   # Gate, server read, ChargeView
├── features/billing/
│   ├── api/
│   │   ├── billing.ts                      # Browser: visits, charge, pay, refund, discount, cancel
│   │   └── charges-server.ts               # Server: charges, one charge
│   ├── components/
│   │   ├── billing-list.tsx                # Filters, states, groups, the refusal notice, live or on demand
│   │   ├── billing-group.tsx               # One doctor's rows, with Charge visit or the charge's link
│   │   ├── charge-list.tsx                 # Charges' table and states
│   │   ├── charge-view.tsx                 # A charge's facts, payments, refunds, and the actions offered
│   │   ├── payment-form.tsx                # Amount, method, confirmation
│   │   ├── refund-form.tsx                 # Administrators
│   │   ├── discount-form.tsx               # Administrators
│   │   ├── cancel-charge.tsx               # The dialog with its reason
│   │   └── outcome-unknown-notice.tsx
│   ├── schemas/billing.ts                  # Response and form schemas
│   ├── offered-charge-actions.ts
│   ├── read-billing-filters.ts
│   ├── read-charge-filters.ts              # Including the default range and the 92-day check
│   └── types.ts
├── features/queue/                         # Uses the moved pieces; behavior unchanged
├── features/fees/schemas/fee.ts            # Uses lib/format/amount.ts
├── features/appointments/                  # Uses PatientFilter from features/patients
├── features/patients/
│   ├── components/patient-filter.tsx       # Moved from appointments
│   ├── components/patient-record.tsx       # Gains "Charges"
│   └── public.ts                           # Exports PatientFilter
├── components/shared/live/
│   ├── live-query-provider.tsx             # Moved from the queue
│   └── last-read.tsx                       # Moved from the queue
├── lib/
│   ├── api/live-query.ts                   # Gains ON_DEMAND_QUERY
│   ├── api/use-live-list.ts                # Moved; takes rootKey and policy
│   ├── use-keep-focus.ts                   # Moved
│   ├── group-by-doctor.ts                  # Moved, generic
│   ├── format/amount.ts                    # normalizeAmount, isAmount, compareAmounts
│   └── auth/app-routes.ts                  # `built: true` on billing and charges
└── messages/{en,ar}.json                   # billing.*, charges.*, shared.lastRead, shared.paymentMethod, patients.filter

e2e/
├── billing.spec.ts                         # Screens, states, roles, live today, on demand otherwise
├── accessibility.spec.ts                   # Gains the new screens and dialogs
├── support/fake-clinic.mjs                 # Gains visits, charges, payments, refunds, discounts
└── live/billing.spec.ts                    # The whole journey with audit counts
```

**Structure Decision**: One new feature, `billing`, matching the backend's Payments module apart from fees, which Phase 4 already built in
`features/fees`. Shared code moves only where this phase is the second real consumer, each move landing first and alone, so that a
regression shows in the tests of the feature it came from.

## Decisions to Record

**[ADR 0015](../../docs/decisions/0015-live-reads-beyond-the-queue.md)**, accepted by the owner with this plan: `GET /visits` may read live, the
`onDemand` policy, and the move of the live pieces. It extends ADR 0013.

## Documents to Update

| File | Change |
|---|---|
| `docs/architecture.md` | "A list that stays current" names Billing and the shared places; add the billing feature and "a money action is sent once" |
| `docs/decisions/README.md`, `0013` | ADR 0015 listed (done), and linked from 0013 |
| `docs/backend-integration.md` | What the live suite confirms about payments: no audited reads, one entry per change, no idempotency key (new hazard H6) |
| `docs/frontend-blueprint.md` | Billing and Charges as built, the patient page's link. Status line |
| `docs/development-guidelines.md` | Money input through `lib/format/amount.ts`, and how a money action handles an unknown outcome |
| `docs/roadmap.md` | Phase status |

## Risks

| Risk | Mitigation |
|---|---|
| A payment recorded twice, after a lost answer or a double click | One request at a time, no retries, the unknown-outcome notice, and tests for each path (R4) |
| An amount mis-compared or rounded | Comparison on digits as whole piastres, with no floating-point step; nothing shown is computed; 100 part payments in the tests |
| The move of the live pieces changes the queue's behavior | Moved first, alone, with the queue's tests unchanged and passing before Billing uses them |
| A refusal's row disappears on the refresh it causes | The notice sits above the list and names the patient (R5) |
| A wrong method recorded by habit | No default method (R7) |
| Reception records a payment against the wrong charge | The confirmation names the patient. A mistake is corrected by an administrator's refund, as the backend intends |
| A receptionist with a stale role sees an administrator action | The API's `403` is shown, and the page refreshes and re-decides |
| Reasons used for medical details | Each reason field says not to; reasons appear only on the charge's page. Staff practice, which the frontend can't enforce |
| A visible Billing page keeps a session alive | As for the queue, under decision Q2 |
| The clinic's clock in the frontend differs from the backend's | H4. Only whether Billing's default date is live could differ |
| Live data accumulates | Dated synthetic data, in the local Docker database only |

## Complexity Tracking

No exceptions to the constitution.
