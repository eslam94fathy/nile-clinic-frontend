# Quickstart: Validate Authentication and App Shell

## Prerequisites

1. Backend running with Docker Compose. Check its port with `docker ps`.
2. In `.env.local` (git-ignored):

   ```text
   BACKEND_API_URL=http://localhost:<port>/api/v1
   SESSION_SECRET=<at least 32 random characters>
   LIVE_ADMIN_EMAIL=<a synthetic administrator>
   LIVE_ADMIN_PASSWORD=<its password>
   ```

   Without `SESSION_SECRET`, the server refuses to start, and names the setting.

3. A synthetic administrator: `docker compose exec app php artisan staff:create-admin --name="Synthetic Admin" --email=synthetic.admin@example.test`, in the backend's folder. The password is typed at a hidden prompt.

## Automated

| Command | Proves |
|---|---|
| `pnpm check` | Types, lint, formatting, translations, logical styles, contrast, contracts, unit tests, and end-to-end tests against the fake backend |
| `pnpm test:e2e:live` | The journeys below against the real API |

Live tests create their own synthetic receptionist, doctor, and profile-less doctor through the API, and deactivate them at the end, as nothing can be deleted. They add audit entries to the development database. All staff share one sign-in limit of 20 a minute, so the tests reuse sessions.

## Scenarios

Each is covered automatically unless marked **manual**.

| # | Do | Expect | Covers |
|---|---|---|---|
| 1 | Sign in as each role, in each language | Landing page with name and translated role | SC-001 |
| 2 | Compare each role's navigation with the blueprint | Exact match | SC-002 |
| 3 | Run the capture journey: sign in, navigate, change password, sign out | The token's value appears in no response, header, page, bundle, cookie readable by script, storage, or address | SC-003 |
| 4 | Send the session cookie's value to the API as a bearer token | `401` | SC-004 |
| 5 | Sign out; press back | Sign-in; nothing from the session | SC-005 |
| 6 | Have an administrator set a new password or deactivate the account, then navigate | Sign-in, with the "session ended" message, and the cookie gone | SC-005 |
| 7 | Open another role's page by its address | "Not allowed", and the response lacks the page's text | SC-007 |
| 8 | Change a person's role, then navigate | Navigation and access follow | US3 |
| 9 | Run the matrix comparison | Agrees with the document | SC-006 |
| 10 | Sign in with a wrong password, in each language | The API's message on the email field | US1 |
| 11 | Stop the API, then load a signed-in page | Error with retry, still signed in. Restart it, retry, and carry on | FR-015 |
| 12 | Sign out in one of two tabs | The other leaves its screen | FR-013 |
| 13 | Let a session end on `patients/5` and on `queue`, then sign in | Landing page for the first; `queue` for the second | FR-014 |
| 14 | Try return addresses to another site and disguised forms | Landing page | Edge case |
| 15 | Sign in as a doctor with no profile | The no-profile state; account and sign-out still work | US6 |
| 16 | Create that doctor's profile, then navigate | The state is gone | US6 |
| 17 | Change the password, with a second session open | Confirmation; this session stays, the other ends, and the old password fails | US5 |
| 18 | Call the same-origin route with a foreign `Origin`, a traversal path, and `auth/sign-in` | Refused, with no backend call | FR-007 |
| 19 | List through the same-origin route | No private address anywhere in the body | FR-006 |
| 20 | Load a page with links in view, and wait | One identity call | Research R3 |
| 21 | Run axe on sign-in, landing, account, not-allowed, not-found, placeholder, and no-profile, in both languages and themes | No violations | SC-009 |
| 22 | Go through sign-in and change password by keyboard | Finishes, with focus visible | SC-009 |
| 23 | **Manual**: close and reopen a normal browser window | Signed out, unless the browser restores tabs | FR-004 |
| 24 | **Manual**: read every screen in Arabic | Direction, wording, and mixed text read correctly | FR-027 |

## Known limits

- Chromium only. Real back-forward cache restoration can't be forced in headless mode, so it's covered by no-store responses, plus a unit test of the reload handler.
- Real 8-hour expiry isn't waited for. Revocation gives the same `401`.
- Client address forwarding isn't built, so H2 stays open.
