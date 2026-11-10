# Quickstart: Validating the Audit Log

## Prerequisites

- `pnpm install`; `.env.local` as in the README.
- For the live journey: the backend running with Docker Compose (`docker ps` for its port, which `BACKEND_API_URL` holds), and the live
  setup's accounts, which gain `auditAdmin` in this phase (research R10).

## Every check

```sh
pnpm check
```

Must pass. It runs types, lint, logical-styles, message-key parity, contrast, unit and component tests, the build, and the Playwright suite
against the fake backend, including axe.

## What the tests must show

| Area | Where | Shows |
|---|---|---|
| Filters to request | `read-audit-filters.test.ts` | Empty filters left out; Arabic digits read; reversed dates, half a record, and bad numbers refused with nothing sent |
| Values | `describe-value.test.ts` | Every row of data-model.md's table, `null`, a mismatched type, an unknown status, a non-scalar |
| Groups | `action-groups.test.ts` | Each of the 44 actions once |
| Minutes | `clinic-time.test.ts` | `0`, `540`, `1440`, out of range |
| One read per press | `use-audit-search.test.tsx` | Double press and Enter twice read once; no read on mount, re-render, Strict Mode, focus, or being shown again; Older and Newer send the filters shown, not the form's |
| Failures | Same | `403` clears; `422` on fields and on `cursor`; a failed move keeps the page |
| Pager | `cursor-pager.test.tsx` | Disabled ends, busy, order in both directions |
| Entry | `audit-entry.test.tsx` | System, unknown, and staff actors; refused; changes; search filters; every link and which use `PatientLink` |
| Page, roles | `e2e/audit.spec.ts` | Administrator searches, pages, sees each state; receptionist and doctor forbidden, with no request; both locales; the address never gains a query |
| Accessibility | `e2e/accessibility.spec.ts` | The page before search, with results, empty, and in error, both directions and themes |
| Live | `e2e/live/audit.spec.ts` | Below |

## The live journey

```sh
pnpm test:e2e:live
```

Signed in as `auditAdmin`, counting `audit.searched` entries by `auditAdmin` with the setup administrator's token after each step:

| Step | Expected count, cumulative |
|---|---|
| Open the audit log, focus events, wait | 0 |
| Search with no filters | 1 |
| Older | 2 |
| Newer | 3 |
| Change a filter without searching, wait | 3 |
| Go to Staff by its link, then back | 3, with the same page shown |
| `router.refresh()` from a change elsewhere, then back | 3 |
| Reversed dates, Search | 3, with the problem on To |
| Search by the patient of a booked appointment | 4, and only that patient's entries |
| Reload | 4, and the page is empty |
| Switch language | 4 |

Also: the newest `audit.searched` entry's `filters` match what was sent; a receptionist and a doctor are refused; the patient's number and
filter values appear in no address visited, in no browser storage, and not in the application server's log.
