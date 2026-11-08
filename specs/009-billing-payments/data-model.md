# Data Model: Billing and Payments

All types derive from `src/lib/api/generated/payments.ts` (constitution V, ADR 0004). Response schemas use
`satisfies z.ZodType<Generated>`. Field lists are in [contracts/payments.openapi.yaml](../../contracts/payments.openapi.yaml); this file
records only what the frontend does with them.

## Entities

| Entity | Contract schema | Used on | Notes |
|---|---|---|---|
| Visit (billing view) | `VisitCharge` | Billing | `id` is the queue entry id, which `POST /visits/{id}/charge` takes. `charge_id` and `balance` are null when `charge_status` is `none` |
| Charge summary | `ChargeSummary` | Charges | No reasons, payments, or refunds. `visit_id` is null only for a cancelled charge whose check-in was undone |
| Charge | `Charge` | A charge's page | Adds who and when for each step, the three reasons, and `payments` and `refunds` in the API's order |
| Payment | `Payment` | A charge's page | Never edited |
| Refund | `Refund` | A charge's page | Never edited. Its reason is shown here only |
| Patient reference | `PatientRef` | All three | `id` (the patient number), `full_name`, `phone`. Nothing else is ever present |
| Doctor reference | `DoctorRef` | All three | `id`, `name`, `title` |
| Staff reference | `StaffRef` | A charge's page | `id`, `name` |

## Money

- Every amount is the contract's `Money`, a string matching `^\d+\.\d{2}$`. It is shown with `<Money>` (`lib/format/money.ts`), which
  formats the string itself, and is never converted to a floating-point number (constitution V).
- Amounts typed by a person are normalized by `normalizeAmount` and checked by `isAmount` (`lib/format/amount.ts`, research R6), then sent
  as strings.
- `compareAmounts(a, b)` orders two amounts by their digits as whole piastres. It is used only to decide what's offered and for checks
  before sending. **No amount is computed for display**: fee, discount, amount due, amount paid, and balance are always the API's.

## States

Charge status, from the API. The frontend never sets or derives one.

```text
             payment (part)            payment (rest), or discount to what's paid
   unpaid ───────────────► partially_paid ─────────────────────────────► paid
     │  ▲                      │    ▲                                     │
     │  └──── refund (all) ────┘    └────────── refund (part) ────────────┘
     │
     └──► cancelled   (only with amount paid 0.00, from unpaid, or from paid by a whole-fee discount; final)
```

A visit's `charge_status` on Billing is the same set with `none` for no active charge, and never `cancelled`.

## What a charge offers

`offeredChargeActions(charge, role)` returns a subset of `pay`, `discount`, `refund`, `cancel`. It is a pure function, tested alone, and
only decides what's shown (research R8).

| Action | Status is not `cancelled` | Other condition | Capability |
|---|---|---|---|
| `pay` | ✓ | `balance` above `0.00` | `billing` |
| `cancel` | ✓ | `amount_paid` is `0.00` | `billing` |
| `discount` | ✓ | none | `discountAndRefund` |
| `refund` | ✓ | `amount_paid` above `0.00` | `discountAndRefund` |

## Filters from the address

Only identifiers, dates, fixed values, and page numbers go in addresses (FR-020). A value that can't be valid is ignored, so an old or
edited link shows a list rather than an error, as on the queue.

| Page | Parameter | Valid | Default |
|---|---|---|---|
| Billing | `date` | `YYYY-MM-DD` | The clinic's today |
| | `doctor_id` | Positive integer | Any doctor |
| | `charge_status` | `none`, `unpaid`, `partially_paid`, `paid` | Any |
| | `page` | Positive integer | 1 |
| Charges | `from`, `to` | `YYYY-MM-DD`. One alone means that day | Six days before the clinic's today, and today |
| | `patient_id`, `doctor_id` | Positive integer | Any |
| | `status` | `unpaid`, `partially_paid`, `paid`, `cancelled` | Any |
| | `page` | Positive integer | 1 |
| A charge | `[id]` | Positive integer, else not found without a read | — |

A Charges range longer than 92 days including both ends, or ending before it starts, isn't read (research R9).

## Form values

| Form | Fields | Rules before sending (feedback only) |
|---|---|---|
| Record payment | `amount`, `method` | `isAmount`, not above `balance`; a method chosen |
| Record refund | `amount`, `method`, `reason` | `isAmount`, not above `amount_paid`; a method chosen; a reason of 1 to 500 characters |
| Set discount | `amount`, `reason` | `isAmount` with zero allowed; a reason of 1 to 500 characters. The limit against the fee less what's paid is left to the API, which reports it on `amount` |
| Cancel charge | `reason` | 1 to 500 characters |

Charging a visit sends no body (FR-005).
