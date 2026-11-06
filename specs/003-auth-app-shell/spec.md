# Feature Specification: Authentication and App Shell

**Feature Branch**: `003-auth-app-shell`

**Created**: 2026-11-06

**Status**: Accepted

**Input**: User description: "Start Phase 3" of `docs/roadmap.md`: BFF, sealed session, sign-in, sign-out, session expiry, proxy, permissions map, the `Can` component, role navigation, `403`, `404`, doctor-without-profile, and change password. Also confirms pagination `meta` on the live API. Done when each role signs in and sees only its navigation, the token is proven absent from browser-reachable places, and expired or deactivated sessions are handled.

## Clarifications

### Session 2026-11-06

- Q: Should closing the browser end the session on that computer, given that reception computers are shared? → A: Yes. Closing the browser ends the session, within what the browser allows, as a browser set to restore previous tabs can keep it. Otherwise the API's 8-hour idle limit decides.
- Q: How should navigation entries for screens built in later phases behave? → A: They appear and open a role-guarded "not available yet" page, which each later phase replaces.
- Q: Where should people land after signing in again, given that returning to a patient's page could record a false "opened" entry against whoever signs in next? → A: They return to the page they were on, without its query string, except that pages which write an audit entry when opened send them to the landing page instead.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in and reach the application (Priority: P1)

A staff member opens the application, enters their email and password, and arrives at a simple landing page inside the signed-in application. If the details are refused, they see the API's message and can try again. If they have forgotten their password, the page tells them to ask an administrator, because no reset flow exists.

**Why this priority**: Nothing else in the application can be reached without it, and every later phase builds on it.

**Independent Test**: With a synthetic account for each role, sign in with correct and incorrect details in both languages, and confirm the outcome each time.

**Acceptance Scenarios**:

1. **Given** an active account, **When** the person submits correct details, **Then** they arrive at the landing page, which shows their name and role.
2. **Given** a wrong password, an unknown email, or a deactivated account, **When** the person submits, **Then** they see the same refusal message from the API, against the email field, and nothing indicates which of the three applied.
3. **Given** too many attempts, **When** the person submits, **Then** the API's message is shown as sent, including its wait time, with no countdown added.
4. **Given** a sign-in in progress, **When** the person submits again, **Then** no second attempt is sent and progress is visible.
5. **Given** the API can't be reached or returns a server error, **When** the person submits, **Then** they see a general failure that doesn't suggest their password was wrong, and can try again.
6. **Given** a person already signed in, **When** they open the sign-in page, **Then** they go to the landing page.
7. **Given** either language, **When** the page is used, **Then** all text, direction, and API messages match that language, and language and theme can both be changed before signing in.

---

### User Story 2 - The token can never reach the browser (Priority: P1)

The clinic's security rule is that the API's access token stays out of reach of anything running in the browser. A security reviewer checks every place a browser can read and finds no token, in any form. A copied session cookie is of no use when sent straight to the API.

**Why this priority**: This protects medical records from a script-injection flaw, is a named completion condition of this phase, and can't be retrofitted.

**Independent Test**: Run an automated journey that signs in, uses the application, and signs out, while capturing everything sent to the browser and everything it stores. Search all of it for the token.

**Acceptance Scenarios**:

1. **Given** a sign-in and a following journey, **When** every response body, response header, page, and script bundle sent to the browser is searched, **Then** the token is not found.
2. **Given** a signed-in browser, **When** its script-readable cookies, local storage, session storage, IndexedDB, and address history are inspected, **Then** the token is not found and the session cookie can't be read by script.
3. **Given** the session cookie's value, **When** it is sent directly to the API as a credential, **Then** the API refuses it.
4. **Given** the application's same-origin route to the API, **When** someone asks it to perform a sign-in, reach outside the API, or carry out a state-changing request from another site, **Then** it refuses.

---

### User Story 3 - See only what your role can use (Priority: P1)

Each person sees the navigation for their role and nothing else. If someone reaches a page their role can't use, they see a clear "not allowed" state in place of the page. If the API refuses something the screen believed was allowed, that refusal wins.

**Why this priority**: It's a named completion condition of this phase. It's also what keeps a receptionist's screen uncluttered and stops a doctor being offered a patient directory the API would refuse.

**Independent Test**: Sign in as each role and compare the navigation with the blueprint's table, then open a page belonging to each other role by typing its address.

**Acceptance Scenarios**:

1. **Given** an administrator, receptionist, or doctor, **When** they are signed in, **Then** the navigation shows exactly the entries in the blueprint's table for that role.
2. **Given** a signed-in person, **When** they open a page their role can't use, **Then** a "not allowed" state appears inside the application's frame, and no content from that page is sent.
3. **Given** a signed-in person, **When** they open an address that doesn't exist, **Then** a neutral not-found state appears, inside the application's frame.
4. **Given** a screen the role map allows, **When** the API answers `403`, **Then** the "not allowed" state appears, whatever the map said.
5. **Given** a role changed by an administrator during a session, **When** the person next loads a page, **Then** their navigation and access follow the new role.
6. **Given** any entry in the verified permission matrix, **When** the automated comparison runs, **Then** the single role map agrees with it.
7. **Given** either language and direction, **When** the navigation is used by keyboard, on a wide or narrow screen, **Then** it's fully operable, and the current page is identified without relying on color alone.

---

### User Story 4 - Sessions end safely (Priority: P1)

A session ends because the person signed out, the API's 8-hour idle limit passed, or an administrator deactivated the account or set a new password. In every case the person returns to sign-in with a brief explanation where one applies, nothing of the previous session stays on screen, and the next person on a shared computer inherits nothing.

**Why this priority**: Reception computers are shared. Patient details left on screen, or kept in memory after sign-out, are a privacy failure.

**Independent Test**: End a session in each way, using synthetic accounts, and confirm the redirect, the cleared state, and that the back button shows nothing.

**Acceptance Scenarios**:

1. **Given** a signed-in person, **When** they sign out, **Then** the API ends that token, the local session is cleared, and they arrive at sign-in with no signed-in screen left mounted or held in memory.
2. **Given** the API can't be reached during sign-out, **When** the person signs out, **Then** the local session is still cleared and they still arrive at sign-in.
3. **Given** a session that was ended, **When** the person presses the back button, **Then** no signed-in content appears.
4. **Given** an expired or revoked token, or a deactivated account, **When** any page load or request gets `401`, **Then** the session and in-memory data are cleared and the person arrives at sign-in with a "your session ended" message.
5. **Given** the session ended while on a page, **When** the person signs in again, **Then** they follow the return rule in FR-014.
6. **Given** two tabs in one browser, **When** the session ends in one, **Then** the other leaves its signed-in screen as soon as it's visible and able to act, without waiting for its next request.
7. **Given** the API is temporarily failing with `500` or is unreachable, **When** a signed-in page loads, **Then** the person stays signed in and sees an error with a way to retry.

---

### User Story 5 - Change your own password (Priority: P2)

Any staff member opens their account page, sees their own name, email, and role, and changes their password by giving the current one and a new one twice. Other devices are signed out and this one stays signed in.

**Why this priority**: It's the only way people can set their own password, including after an administrator has set one for them, but the application is usable without it.

**Independent Test**: Change the password of a synthetic account, confirm the new one works and the old one doesn't, and that a second session on the same account ends.

**Acceptance Scenarios**:

1. **Given** correct details, **When** the person submits, **Then** a confirmation says the password changed and that other sessions were ended, the fields are cleared, and they remain signed in.
2. **Given** a wrong current password, **When** they submit, **Then** the API's message appears on the current-password field.
3. **Given** a new password outside 12–72 characters, or a confirmation that doesn't match, **When** they submit, **Then** quick feedback appears on that field, and any different answer from the API takes precedence.
4. **Given** too many wrong attempts, **When** they submit, **Then** the API's message appears as sent.
5. **Given** an API error with no matching field, **When** it occurs, **Then** it appears at the form's level and isn't dropped.
6. **Given** a submission in progress, **When** they submit again, **Then** no second request is sent.
7. **Given** the password fields, **When** the form is used, **Then** the fields work with password managers and their values never appear in an address, log, or browser storage.

---

### User Story 6 - A doctor without a profile knows what to do (Priority: P2)

A person with the doctor role can have an account before an administrator has created their doctor profile. They can sign in, but their doctor screens can't work. They see a clear message to contact an administrator, not a confusing "not found".

**Why this priority**: Setting up a new doctor is a normal sequence of steps, so this state will occur, but it affects few people and briefly.

**Independent Test**: Sign in with a synthetic doctor account that has no profile, then with one that has.

**Acceptance Scenarios**:

1. **Given** a doctor with no profile, **When** they open the landing page or any doctor screen, **Then** they see the "profile not set up, contact an administrator" state in place of that screen's content.
2. **Given** that same doctor, **When** they use the account page, language switch, or sign-out, **Then** those work normally.
3. **Given** an administrator then creates the profile, **When** the doctor next loads a page, **Then** the state is gone.
4. **Given** the profile check itself fails for another reason, **When** a doctor loads a page, **Then** they see an error with a retry, and not the "profile not set up" state.

---

### User Story 7 - Later phases can rely on the list format (Priority: P3)

The API's contracts leave the pagination details of its lists unspecified. A developer checks the real API and records what it returns, so that later list screens are built on verified facts rather than a guess.

**Why this priority**: It's required by the roadmap and is quick, but nothing a person sees in this phase depends on it.

**Independent Test**: Read the recorded result and repeat the request against the running API.

**Acceptance Scenarios**:

1. **Given** the running API, **When** a standard list is requested, **Then** its actual pagination fields are recorded in the backend integration document, along with the date and backend version checked.
2. **Given** the recorded fields, **When** the shared list type is compared with them, **Then** they agree, and any difference from the existing shared table's expectations is corrected.

---

### Edge Cases

- A person reaches a signed-in address with no session: they go to sign-in in the same language, without seeing the page.
- A person reaches an address that doesn't exist with no session: they get the ordinary not-found page, as before this phase, not a sign-in page.
- A cookie is present but tampered with, stale, or sealed with an old secret: it's treated as no session and cleared, and doesn't produce an error page.
- A return address that points to another site, or uses a disguised form of one, is ignored and the person goes to the landing page.
- A person signs in on a computer where the previous person's session expired: nothing from the previous session is visible, and the return rule in FR-014 applies.
- A request is in progress when the session ends: its result is discarded, and only one redirect to sign-in occurs, however many requests fail together.
- The language is changed on the sign-in page, or during a session: the page reloads in the new language, what was typed isn't kept, and any session continues.
- An account's name or email is in the other language or mixed direction: it displays as written, in its own direction.
- The application's no-profile check returns `403`, because the person's role changed from doctor: the normal role rules apply on next load.
- A very long name appears in the top bar: it's shortened visibly without breaking the layout, and remains available in full.
- JavaScript is disabled: the existing notice is shown. This internal application doesn't otherwise support working without it.

## Requirements *(mandatory)*

### Functional Requirements

**Sign-in and session**

- **FR-001**: Staff MUST be able to sign in with email and password. The sign-in page MUST state that forgotten passwords are handled by an administrator, and MUST NOT offer a reset.
- **FR-002**: The application's server MUST hold the API token inside a sealed session that browser scripts can't read and that is useless when presented directly to the API. Only the signed-in person's profile may be returned to the browser.
- **FR-003**: Sign-in refusals MUST show the API's message on its field. The application MUST NOT reveal which reason applied, and MUST NOT interpret message text.
- **FR-004**: The session's end MUST be decided by the API. The session's stored lifetime MUST NOT outlast or replace the API's answer. Closing the browser MUST end the session on that computer, within what the browser allows: a browser set to restore previous tabs may keep it.
- **FR-005**: Each signed-in page load MUST confirm the person's identity and role with the API, without caching it across requests or between people.

**Same-origin route to the API**

- **FR-006**: Browser code MUST reach the API only through a same-origin route on the application's server, which adds the token and active language and returns the API's status and body. The one change to a body is removing the page-link fields of paginated lists, because they hold the API's private address and the request's query string. Nothing the application uses depends on them.
- **FR-007**: That route MUST refuse sign-in requests, requests that escape the API's base path by any encoding, and state-changing requests from another origin.
- **FR-008**: That route MUST mark responses as not to be stored, MUST NOT forward browser cookies to the API, and MUST NOT log bodies, query strings, tokens, or credentials.
- **FR-009**: Requests from the application's server to the API MUST send the active language, and MUST NOT be stored in any shared cache.

**Session end**

- **FR-010**: Signing out MUST ask the API to end the token, then always clear the local session, whatever the API answered, and MUST leave no signed-in screen mounted or held in memory.
- **FR-011**: Any `401` MUST clear the session and all in-memory data and send the person to sign-in, with a message saying their session ended. Simultaneous failures MUST cause only one redirect.
- **FR-012**: Pages sent to a signed-in person MUST NOT be restorable after the session ends, including by the back button.
- **FR-013**: When a session ends in one tab, other tabs of that browser MUST leave their signed-in screens without waiting for their next request.
- **FR-014**: After signing in again, the person MUST return to the page they were on, except that return addresses MUST be same-origin, MUST NOT carry a query string, and MUST NOT lead to a page that writes an audit entry when opened. In those cases they go to the landing page. Any page in the audited list MUST be declared in one place.
- **FR-015**: A `500` or an unreachable API MUST NOT end the session, and MUST show an error with a retry.

**Roles and navigation**

- **FR-016**: One single role map MUST hold every capability in the verified permission matrix. Navigation, page guards, and the reusable show-or-hide control MUST all read from it.
- **FR-017**: The navigation MUST match the blueprint's table for each role. The top bar MUST offer language, theme, account, and sign-out to everyone.
- **FR-018**: Navigation entries whose screens belong to later phases MUST appear and open a "not available yet" page, guarded by role like any other page. These pages MUST NOT call the API for feature data. Each later phase replaces its placeholder.
- **FR-019**: Pages MUST be guarded by role on the server, showing a "not allowed" state with no page content sent to the browser. The API's `403` MUST produce the same state whatever the map says.
- **FR-020**: A `404` from the API or an unknown address MUST show a neutral not-found state that doesn't imply whether a record exists.
- **FR-021**: Signed-in addresses requested with no session MUST go to sign-in, in the same language. This early redirect MUST NOT be treated as a security decision: the API's answer remains the boundary.
- **FR-022**: The address with no page name MUST lead to the landing page if signed in, otherwise to sign-in. The landing page MUST be a simple welcome, as role dashboards are Phase 12.

**Doctors without a profile**

- **FR-023**: For a person with the doctor role, the landing page and doctor screens MUST show a dedicated "profile not set up, contact an administrator" state when, and only when, the API's own-doctor-profile endpoint returns `404`. Account, language, theme, and sign-out MUST remain available.

**Account**

- **FR-024**: Every role MUST have an account page showing their own name, email, and role, translated, with no other role's capabilities offered.
- **FR-025**: The account page MUST let the person change their password, giving the current password, a new one, and its confirmation. It MUST give quick feedback for 12–72 characters and matching, while the API's answer always wins.
- **FR-026**: After a successful change, the person MUST remain signed in, the fields MUST be cleared, and a confirmation MUST state that other sessions were ended.

**Cross-cutting**

- **FR-027**: All new screens MUST provide loading, error, empty where relevant, and success states, using the shared design system, with all text in both languages and working in both directions.
- **FR-028**: Every mutation MUST show progress, prevent double submission, map API errors to fields, show other errors at form level, and confirm success.
- **FR-029**: Passwords, tokens, profile details, and query strings MUST NOT be written to logs, addresses, analytics, error reports, or persistent browser storage.
- **FR-030**: In-memory data MUST follow the audit-safe query policy, with audited reads not refetched, retried, or prefetched. No page in this phase may make an audited read.
- **FR-031**: The real pagination fields of a standard list MUST be confirmed on the running API and recorded, and the shared list type MUST agree with them.

### Key Entities

- **Staff member**: The signed-in person, as returned by the API: id, name, email, role, active flag, and two timestamps. The source of identity and role.
- **Session**: The server-held, sealed record of one signed-in browser. It holds the API token and nothing a browser may read.
- **Role**: Administrator, receptionist, or doctor. The API's fixed identifier, translated for display.
- **Capability**: One thing a role may do, transcribed from the verified permission matrix.
- **Navigation entry**: A translated label, a destination, and the capability that decides who sees it.
- **Doctor profile status**: For a doctor only: present, missing, or unknown because the check failed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Each of the three roles can sign in, in each language, and reach the landing page, in 100% of test runs against the real API.
- **SC-002**: For each role, the navigation matches the blueprint's table exactly, with zero extra and zero missing entries.
- **SC-003**: A captured journey covering sign-in, navigation, password change, and sign-out finds the token in zero places across every response, stored value, and address reachable by the browser.
- **SC-004**: A copied session cookie sent directly to the API is refused in 100% of attempts.
- **SC-005**: All four session endings (sign-out, expiry, deactivation, password set by an administrator) return the person to sign-in, with no signed-in content available by the back button afterwards.
- **SC-006**: 100% of permission matrix entries agree with the role map, by automated comparison.
- **SC-007**: A signed-in person of each role who opens a page for another role sees "not allowed", and the page's content is absent from what was sent.
- **SC-008**: A person with a new account can sign in and change their password in under one minute, without help.
- **SC-009**: Automated accessibility checks report no WCAG 2.2 AA violations on the new screens in either language or direction, and each journey can be finished by keyboard alone.
- **SC-010**: Every quality check passes, and results recorded for this phase are ones actually observed.

## Assumptions

- The blueprint's navigation table and route list stand as written. Doctors get no directory screen for doctors or specialties in this phase.
- The existing landing page's service status check moves to the sign-in page, where staff can see that the API is unavailable before trying to sign in. The separate status page goes away, as the signed-in landing page takes its place.
- Inactivity sign-out stays out of scope, following roadmap decision Q2.
- Deployment is undecided (roadmap Q6), so the real client address isn't sent to the API in this phase. It waits for the backend change and the deployment decision. Until the backend trusts the application's server, all staff share one sign-in limit and audit entries show the server's address. This remains a production blocker (hazard H2), and development use is unaffected.
- Live end-to-end tests run against the Docker backend with synthetic accounts, created through the backend's own command and API. Expiry can be simulated by revoking or removing a token.
- An administrator setting someone's password, and deactivating an account, are built in Phase 4. Tests of those session endings call the API directly.
- Session secret management in development is a local setting. Production secret storage is on the existing pre-production list.
- A Content Security Policy remains in Phase 13.

### Out of scope

Staff management, role dashboards with data, every feature screen from Phase 4 onward, password reset, inactivity sign-out, and any backend change.
