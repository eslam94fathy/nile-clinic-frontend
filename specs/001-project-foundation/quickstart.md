# Quickstart: Validating the Project Foundation

Prerequisites: Node 24, pnpm 12, and the backend's Docker stack running. Check its port with `docker ps`; the backend's
default is 8080, and the development machine uses 8081. Commands and expected results are specified in
[the interface contract](contracts/routing-and-commands.md).

## 1. Setup

1. Run `pnpm install` and `pnpm exec playwright install chromium`.
2. Copy `.env.example` to `.env.local`, and set `BACKEND_API_URL` to `http://localhost:<port>/api/v1`.
3. Run `pnpm dev`, then open <http://localhost:3000>.

**Expected**: Redirect to `/ar`, Arabic, right to left, with a "working" status and the check time in Cairo time.

## 2. Language

| Do | Expected |
|---|---|
| Use the language switch | `/en`, English, left to right |
| Open the bare address again | `/en`, remembered |
| Open `/fr` | Not-found page in the saved language |
| Clear cookies; open the bare address with an English browser | `/ar` |
| Disable JavaScript; open `/ar` | Arabic, right to left, and a notice that the status needs JavaScript |

## 3. Connectivity

| Do | Expected |
|---|---|
| Stop the backend, or point the setting at a dead port, and reload | "Cannot reach the system" within about 5 seconds; "check again" present |
| Point the setting at a non-API address, such as phpMyAdmin | "Cannot reach the system", never "working" |
| Restore the backend, then "check again" | "Working" |
| View page source | Backend address absent |

## 4. Configuration

| Do | Expected |
|---|---|
| Remove `BACKEND_API_URL`, and start | Stops with a message naming the setting; no values are printed |
| Set `CLINIC_TIMEZONE=Mars/Base`, and start | Stops with a message naming the setting |

## 5. Checks

| Do | Expected |
|---|---|
| `pnpm check` | Passes, in under 5 minutes |
| `pnpm test:e2e:live` with the backend running | Passes |
| Temporarily break each rule: `any`, a physical style such as `ml-4`, a missing translation key, an edited contract, a server-only import in a client component | The matching check fails, naming the problem |

## 6. Contracts

Run `pnpm contracts:refresh <path-to-backend-checkout>`. **Expected**: `contracts/SOURCE.json` holds the checkout's commit,
and there are no type differences if the backend hasn't changed.
