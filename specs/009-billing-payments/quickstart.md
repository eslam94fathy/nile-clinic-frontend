# Quickstart: Validating Billing and Payments

## Prerequisites

- The backend running with Docker Compose. Check its port with `docker ps`; `BACKEND_API_URL` in `.env.local` holds it.
- `LIVE_ADMIN_EMAIL` and `LIVE_ADMIN_PASSWORD` in `.env.local`, for an account from `php artisan staff:create-admin`.
- Synthetic data only. Reasons in tests are plainly synthetic, such as "Synthetic overpayment".

## Automated

```powershell
pnpm check          # Every quality check, including unit tests and the fake backend's e2e suite
pnpm test:e2e:live  # Against the running API
```

Both must pass, and only results actually observed are recorded.

## What the unit and component tests must show

| Subject | Expected |
|---|---|
| `isAmount`, `compareAmounts` | `0.01`, `99999.99`, `100000.00` accepted; `0`, `0.001`, `100000.01`, `-1`, `1e3`, and empty refused; zero accepted only when allowed; Arabic digits and separator normalized; ordering correct across lengths, such as `9.99` against `10.00` |
| Many small payments | 100 payments of `0.01` against a balance of `1.00` compared without drift: the 100th fits, a 101st doesn't |
| `offeredChargeActions` | Each row of the table in [data-model.md](data-model.md), for both roles, and nothing on a cancelled charge |
| Filters from the address | Invalid values ignored; Charges' default range; one date alone; over 92 days and reversed ranges caught |
| Payment form | Amount starts as the balance; no method chosen; checks before sending; the confirmation's wording; one request for repeated clicks; an unknown outcome shows its notice and sends nothing more |
| Refund, discount, cancel | The same for each, and that receptionists aren't offered discount or refund |
| Moved live pieces | The queue's existing tests pass unchanged after the move |

## What the fake backend's suite must show

| Journey | Expected |
|---|---|
| Billing for today | Grouped by doctor in the API's order; one read per 15 seconds on Playwright's clock; none on a hidden tab or another page; a failed refresh keeps the list with the notice |
| Billing for another date | One read on opening and on "Refresh"; none on the clock, on focus, or on reconnect |
| Charge a visit | The charge's page opens, confirming the amount; focus on the payment form |
| Charge refused (no fee, left, already charged) | The notice above the list naming the patient; the list read again |
| Pay in two parts, cash then card | Partially paid, then paid; the form gone when nothing is owed |
| Payment above the balance | Caught before sending; the API's refusal shown when forced |
| Payment with no answer (connection dropped, `502`) | One request only; the notice; the charge read again |
| Charge changed meanwhile (cancelled elsewhere) | The API's message; the charge read again |
| Discount, then whole-fee discount | Amount due falls, fee unchanged; then paid |
| Refund | Amount paid falls, balance rises, payment unchanged, reason shown |
| Cancel with no money held | Cancelled, with reason; Billing offers "Charge visit" again |
| Charges | Default last 7 days; each filter; the patient filter from the patient's page; over 92 days caught with no read |
| A charge that doesn't exist, or a bad id | Neutral not found |
| Roles | Administrators: everything. Receptionists: no discount or refund, and a forced one shows the API's `403`. Doctors: no navigation, and the forbidden state on each address with no billing read |
| `401` on any read or action | The sign-in redirect |
| Addresses and storage | No amount, reason, or patient detail in any address or in browser storage |
| Axe | No violations on `/billing`, `/charges`, `/charges/[id]` with each form and dialog open, in both languages and directions |

## What the live suite must show

Against the Docker API, with a dedicated synthetic doctor with a fee and synthetic patients. Audit counts are read before and after each step
with the administrator's `GET /audit-entries`, which is itself audited, so its own entries are counted out.

| Journey | Expected |
|---|---|
| Open Billing, Charges, and a charge, reload each | No new entries of any kind |
| Charge a checked-in visit | `charge.created` once; fee equals the doctor's fee |
| Pay part in cash, then the rest by card | `payment.recorded` twice; partially paid, then paid; balance `0.00` |
| Undo the check-in of a charged visit, from the queue | Refused with the API's message on the row's action |
| Discount (administrator) | `discount.set` once; fee unchanged |
| Refund (administrator) | `refund.recorded` once; payment unchanged |
| Cancel a charge with no money held | `charge.cancelled` once; the visit can be charged again |
| Receptionist forces a refund | `403`, shown as a refusal |
| Whole journey | No `patient.opened` unless a patient's name was followed, and then exactly one |
