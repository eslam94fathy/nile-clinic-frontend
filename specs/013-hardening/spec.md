# Feature Specification: Hardening and Production Readiness

**Feature Branch**: `013-hardening`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "Start Phase 13" of `docs/roadmap.md`: hardening and production readiness. Full journeys per role (administrator, receptionist, doctor) and locale (ar, en) against the running API; an accessibility review (WCAG 2.2 AA) and a security review; security headers including a Content Security Policy that allows the fixed theme script by hash or nonce ([ADR 0007](../../docs/decisions/0007-design-system-foundation.md)); performance measured; deployment documentation; and the roadmap's pre-production items that the frontend can own. Remove shared components that still have no real consumer (the Phase 2 exception), counting `CursorPager` (one consumer) and the unused "not available yet" placeholder. Owner decisions, 2026-11-11: deployment (Q6) is a Docker image running the Node server behind a reverse proxy that terminates HTTPS, on the same host or network as the backend's Docker Compose, so the backend trusts one known proxy address (H2). An inactivity lock covers medical-record pages only (a record, its addenda, a patient's history) after 5 minutes without keyboard, pointer, or touch activity; it covers the page without discarding unsaved text, never saves automatically, and unlocks only with the same person's password through a fresh sign-in that replaces the session; anyone else can only sign out, after a warning that unsaved text will be lost. Backend items (trusted proxies, the draft version check G9) are raised, not built; legal review and browser-extension management are deployment notes.

## Context

Phases 1–12 built every screen the clinic needs. Each phase tested its own work, but nothing yet proves the whole application, in the form it will run in production, holds together: across roles and languages, against the real API, behind the security controls a medical system needs, and deployable by someone other than its author.

Phase 8's privacy review left one condition for production: a medical record must not stay on an unattended screen. Decision Q2 rejected an inactivity sign-out for the front desk, and a record page makes no requests, so nothing today notices that a doctor walked away. The owner accepted the risk only until this phase.

This phase adds one new behavior, the inactivity lock, and otherwise changes no screen's purpose. Everything else is proof, protection, removal of unused code, and documentation.

Phase 12's branch had not been merged when this phase started, so this branch starts from it, as Phase 8 did from Phase 7.

## Clarifications

### Session 2026-11-11

- Q: Where will the frontend run in production (decision Q6)? → A: A Docker image running the Node server, behind a reverse proxy that terminates HTTPS, on the same host or network as the backend's Docker Compose. The backend then trusts one known proxy address.
- Q: How is the inactivity lock unlocked? → A: Only with the same person's password, through a fresh sign-in that replaces the session. Anyone else can only sign out, after a warning that unsaved text will be lost.
- Q: Which pages does the lock cover? → A: Medical-record pages only: a medical record with its addenda, and a patient's history.
- Q: After how long without activity does a page lock? → A: 5 minutes without keyboard, pointer, or touch activity.
- Q: Should a medical-record page warn before it locks? → A: No warning; it locks at 5 minutes, as unlocking loses nothing.
- Q: What should the container's health check test? → A: Only that the frontend itself is serving. A backend outage doesn't mark it unhealthy; the System status page already shows the backend's state.
- Q: How should production errors be observed? → A: Through the container's console output only, which Docker collects. No error-reporting service; nothing personal may reach that output.
- Q: Are the speed targets right (content within 2.5 seconds, a response to a press within 200 milliseconds, for at least 75% of measurements)? → A: Yes. A miss is fixed, or recorded with its reason and accepted by the owner.
- Q: Should the full role journeys be a permanent automated suite or a one-off run? → A: A permanent suite, part of the live end-to-end tests, run before every release.
- Q: (Security review) Reloading a locked record showed it again. How should the lock survive a reload or a new tab? → A: A lock marker cookie, set by the page without a request; while it's set, medical-record pages load with only the lock and read nothing until unlocked.
- Q: (Code review) Should work on other pages of the same tab count as activity, when a record kept by Back is shown again? → A: Yes; the record locks only if the whole tab sat idle for 5 minutes.
- Q: Every page streams inline scripts written at request time, so a hash can't allow them, and a per-request nonce is incompatible with the prerendered page shells (measured during planning, research R1). How should the content security policy treat inline scripts? → A: Allow inline scripts, and keep every other part strict: scripts only from the application itself, and no connections, images, fonts, forms, or framing to or from other sites.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A medical record locks when the doctor walks away (Priority: P1)

A doctor is writing or reading a medical record, or a patient's history, and leaves the computer. After 5 minutes with no keyboard, pointer, or touch activity on that page, an opaque lock covers it. Nobody passing can read or reach the record. When the doctor returns, they enter their password and carry on exactly where they were, with every unsaved word still in place. If someone else is at the computer, the only thing they can do is sign the doctor out, and they are warned first that unsaved text will be lost.

**Why this priority**: It is the one condition the privacy review set for production. Without it, the clinic can't go live with medical records.

**Independent Test**: As a doctor with synthetic data, open a draft record, type unsaved text, and wait out the interval without touching the page. Confirm the lock covers the record, that nothing behind it can be read, focused, or reached by keyboard or assistive technology, that no save request was sent, and that entering the doctor's password restores the page with the text intact. Repeat with a wrong password, and with the sign-out choice.

**Acceptance Scenarios**:

1. **Given** a doctor is on a medical-record page, **When** 5 minutes pass with no keyboard, pointer, or touch activity on that page, **Then** the page is covered by a lock that shows nothing of the record, names the signed-in person, and asks only for their password.
2. **Given** a record has unsaved text, **When** the page locks, **Then** nothing is saved, and the text is still there, unchanged, after unlocking.
3. **Given** the page is locked, **When** the same person enters their correct password, **Then** the lock closes, the session is replaced by the fresh one, and the page continues exactly as it was, with no re-reading of the record.
4. **Given** the page is locked, **When** a wrong password is entered, **Then** the backend's message is shown on the lock, and the page stays locked.
5. **Given** the page is locked, **When** someone chooses to sign out, **Then** they are warned that any unsaved text will be lost and asked to confirm; on confirming, the person is signed out as usual.
6. **Given** a doctor is active on the page (typing, scrolling, moving the pointer, touching), **When** less than 5 minutes have passed since their last activity, **Then** the page never locks.
7. **Given** the page is locked, **When** a keyboard or screen-reader user meets the lock, **Then** focus is on the password field, the lock can be fully operated by keyboard, and the content behind it is not announced.

---

### User Story 2 - The production application is protected by the browser's security controls (Priority: P1)

The clinic's IT staff deploy the application, and every page it serves tells the browser to refuse what a medical system should never allow: scripts from anywhere but the application itself, framing by another site, leaking addresses (which can hold search terms) to other sites, guessing file types, and plain-HTTP connections. A security review of the whole application finds nothing open.

**Why this priority**: These controls limit the damage of any flaw that slips through. A missing one is invisible until it is exploited, and the data is medical.

**Independent Test**: Against a production build, fetch each kind of page (public, signed in, error) and each application endpoint, and confirm the required headers are present and correct; confirm with a browser that the pages run with no policy violations in both languages and both themes, including before the theme is applied.

**Acceptance Scenarios**:

1. **Given** a production build, **When** any page is served, **Then** it carries a content security policy that allows scripts only from the application itself and inline (research R1), and allows no connections, images, fonts, form submissions, or plugins from other sites, a policy against framing by any other site, a referrer policy that never sends the address to another site, a no-sniffing instruction, and a permissions policy that turns off device features the application doesn't use.
2. **Given** the content security policy is in force, **When** each screen is used in both languages and both themes, **Then** the browser reports no violation, and the theme appears with no flash.
3. **Given** a page shows personal or clinical data, **When** it is served, **Then** it is marked so that no shared cache stores it.
4. **Given** the security review, **When** it is complete, **Then** every finding is fixed or explicitly accepted by the owner, and the record says which.

---

### User Story 3 - Every role's day works end to end, in both languages (Priority: P2)

Before go-live, the clinic's day is played through on a production build against the running API: an administrator sets up a doctor until they can be booked; a receptionist registers a patient, books, checks them in, and takes payment; the doctor calls the patient, writes and finalizes the record, and adds an addendum; the administrator reviews the reports and the audit trail. Each journey passes in Arabic and in English.

**Why this priority**: Each phase proved its own screens. Only full journeys prove the hand-offs between roles, which is where the clinic's day actually breaks.

**Independent Test**: Run the journey suite, which stays in the live end-to-end tests for every later release, against the running API with synthetic data, once per locale, and record the observed results.

**Acceptance Scenarios**:

1. **Given** the running API and a production build, **When** the journeys run, **Then** each role completes its part, and each hand-off (bookable doctor, booked patient, checked-in patient, finished visit, charge, report figure) is visible to the next role.
2. **Given** each journey, **When** it runs in Arabic and in English, **Then** it passes in both, with the page direction matching the language.
3. **Given** a journey crosses an audited read, **When** it completes, **Then** the audit trail holds exactly the entries the person's actions caused, and no more.
4. **Given** each role, **When** it tries an action or page belonging to another role, **Then** it is refused and shown the matching state.

---

### User Story 4 - Every screen is usable by every member of staff (Priority: P2)

A member of staff who uses only the keyboard, a screen reader, high zoom, or one language direction can do their whole job. Every screen is reviewed against WCAG 2.2 AA in both directions and both themes, by automated checks and by hand.

**Why this priority**: Accessibility was checked per phase on the screens built then; a whole-application review catches what falls between phases (focus after navigation, shared frame, consistency).

**Independent Test**: Run automated accessibility checks on every screen in both languages and themes, and complete the by-hand checklist (keyboard-only journey, screen reader, 200% and 400% zoom, reduced motion), recording each result.

**Acceptance Scenarios**:

1. **Given** every screen, in both languages and both themes, **When** automated accessibility checks run, **Then** they report no violation at the AA level.
2. **Given** a keyboard-only user, **When** they complete each role's journey, **Then** every control is reachable, focus is always visible, and focus never lands behind a dialog or lock.
3. **Given** the by-hand checklist, **When** it is completed, **Then** each item has a recorded result, and every failure is fixed or accepted by the owner.

---

### User Story 5 - IT staff can deploy and run the application without its author (Priority: P3)

The clinic's IT staff receive a container image and documentation that tell them how to build, configure, start, upgrade, and check the application beside the backend, behind a reverse proxy that terminates HTTPS, and what must be done outside the application before production.

**Why this priority**: The decision on where to deploy (Q6) is made; without packaging and documentation it can't be acted on. It matters at go-live, after the protections above exist.

**Independent Test**: Following only the documentation, someone builds the image, starts it beside a running backend behind a local HTTPS proxy, signs in, and confirms the health check reports healthy; then confirms the documented pre-production list names every item from the roadmap.

**Acceptance Scenarios**:

1. **Given** the documentation, **When** IT staff follow it, **Then** they can build and start the application with only the documented settings, and it refuses to start, with a clear message, if a required setting is missing or invalid.
2. **Given** the documentation, **When** they read the pre-production list, **Then** it covers trusted proxies on the backend (H2), keeping the clinic time zone the same in both applications (H4), the session secret in a secret store, HTTPS everywhere, managing browser extensions on clinic computers, the legal review and its questions from Phase 8's privacy review, and the draft version check to raise with the backend (G9).
3. **Given** the running container, **When** its health is checked, **Then** it reports whether the application is serving, without revealing configuration or data.
4. **Given** the backend's trusted-proxy change, **When** it is requested, **Then** the request is a written item for the backend's owner, and no backend file is changed by this phase.

---

### User Story 6 - Pages respond quickly enough for the front desk (Priority: P3)

Reception works under time pressure. The main screens of each role are measured on a production build, and any that misses the targets is improved or its reason recorded.

**Why this priority**: No phase has measured speed as a whole. It matters, but a slow screen is less harmful than an exposed record or an open hole.

**Independent Test**: Measure each role's main screens on a production build against the running API, and record the figures against the targets.

**Acceptance Scenarios**:

1. **Given** the main screens of each role, **When** they are measured, **Then** the figures are recorded and each meets the targets in Success Criteria, or the reason it doesn't is recorded and accepted by the owner.

---

### User Story 7 - Unused shared code is gone (Priority: P3)

Shared components kept since Phase 2 without a real consumer are removed, so that nothing in the application exists only in case it is needed. A component with a single consumer moves into that feature.

**Why this priority**: A housekeeping item recorded as an exception in Phase 2's plan. It reduces what must be maintained and reviewed, but changes nothing a person sees.

**Independent Test**: List each shared component and its consumers; confirm every remaining shared component has at least two real consumers outside the design preview, or a recorded reason, and that all checks still pass.

**Acceptance Scenarios**:

1. **Given** the list of shared components, **When** the clean-up is done, **Then** each has two or more real consumers, or has been moved into its only consumer, or removed, with the preview updated to match.
2. **Given** the "not available yet" placeholder and the `CursorPager`, **When** they are reviewed, **Then** the placeholder is removed and the pager is moved into the audit feature, or each keeps a recorded reason.

---

### Edge Cases

- **Saving when the lock arrives.** A save, finalize, or addendum already sent completes; its outcome is shown once the page is unlocked, and nothing is resent.
- **A dialog open when the lock arrives** (such as a finalize confirmation). The lock covers it too; after unlocking, the dialog is as it was.
- **The session ended while locked.** The backend's idle timeout ran out, or another tab signed out. Unlocking is still a fresh sign-in, so the correct password still restores the page and its text.
- **The account was deactivated, or its password changed, while locked.** The sign-in is refused with the backend's message; the only remaining choice is to sign out, after the warning.
- **Too many attempts.** The backend's throttle message is shown as sent (gap G5); the page stays locked.
- **Another tab.** Each medical-record tab notices only its own activity and locks on its own. Unlocking one tab replaces the session for all tabs, and other locked tabs still need their own unlock.
- **A hidden tab.** Time passes while the tab is hidden; on returning after 5 minutes, the lock is already in place before any content is shown.
- **Leaving a locked page.** The back button, the address bar, or a link elsewhere. The same unsaved-text warning as today applies, and the lock is never bypassed to show content.
- **The unlocking sign-in belongs to another account.** It can't happen: the lock asks for the password of the person shown on it, and nothing else.
- **A page showing content in the browser's history or tab preview.** The lock covers the visible page; the browser's own snapshots are outside the application's reach and are recorded as such.
- **A policy violation in production.** A blocked script means a broken page; violations must be found before release, as no reporting endpoint is planned.
- **The reverse proxy adds its own headers.** The documentation says which headers the application sets and which the proxy must set (such as strict transport security), so neither is missing or duplicated with conflicting values.

## Requirements *(mandatory)*

### Functional Requirements

#### Inactivity lock

- **FR-001**: Medical-record pages (a medical record with its addenda, and a patient's history) MUST lock after 5 minutes without keyboard, pointer, scroll, or touch activity in that tab. No other page locks. Once a page has locked, reloading it, entering its address again, or opening any medical-record page in another tab MUST show only the lock, and MUST read nothing, until the person unlocks.
- **FR-002**: The lock MUST fully hide the page's content, MUST prevent reaching it by pointer, keyboard, or assistive technology, and MUST show the signed-in person's name, a password field, an unlock action, and a sign-out action.
- **FR-003**: Locking MUST NOT discard, change, or save any unsaved text, and MUST NOT send any request.
- **FR-004**: Unlocking MUST require the password of the person shown on the lock, checked by a fresh sign-in to the backend for that person's account. On success, the fresh session MUST replace the current one, the previous session MUST be ended where it still exists, and the page MUST continue exactly as before, without re-reading the record.
- **FR-005**: A refused unlock MUST show the backend's message as sent and keep the page locked. The password MUST NOT be kept anywhere after the attempt.
- **FR-006**: Signing out from the lock MUST first warn that any unsaved text will be lost and ask for confirmation; it then signs out as anywhere else.
- **FR-007**: Unlocking MUST NOT write any audit entry beyond the backend's own record of the fresh sign-in and, where the previous session still exists, of its sign-out; in particular, it MUST NOT re-open the record or the history.
- **FR-008**: A request already in progress when the page locks MUST complete normally, and its outcome MUST be shown after unlocking.

#### Security

- **FR-009**: Every page and application endpoint in a production build MUST send a content security policy allowing scripts only from the application itself and inline, styles only from the application and inline, connections, images, fonts, and form submissions only to the application, no plugins, no change of base address, and no framing by other sites. The theme script MUST remain the only raw HTML the application writes, enforced by a check.
- **FR-010**: Every response MUST send a referrer policy that never sends an address to another site, a no-sniffing instruction, and a permissions policy turning off device features the application doesn't use.
- **FR-011**: Every page or endpoint whose response depends on the signed-in person MUST be marked as not storable by shared caches.
- **FR-012**: The documentation MUST state which security headers the reverse proxy sets (at least strict transport security) and which the application sets.
- **FR-013**: A security review of the whole application MUST be carried out, and each finding MUST be fixed or accepted by the owner in writing.
- **FR-014**: The proof that tokens never reach the browser MUST be re-run on a production build, covering the new lock and its fresh sign-in.

#### Proof

- **FR-015**: A journey suite MUST cover each role's full day as described in User Story 3, against the running API, on a production build, in Arabic and in English, using synthetic data only. It MUST stay in the live end-to-end tests, and the documentation MUST say to run it before every release.
- **FR-016**: Automated accessibility checks MUST cover every screen in both languages and both themes, and a by-hand checklist MUST be completed and its results recorded.
- **FR-017**: The main screens of each role MUST be measured on a production build, and the figures recorded against the targets.

#### Deployment

- **FR-018**: The project MUST provide a container image definition that builds and runs the production application, and a working example of the reverse proxy in front of it.
- **FR-019**: The application MUST refuse to start, with a clear message naming the setting, when a required setting is missing or invalid. (Startup validation exists since Phase 1; this phase confirms it inside the container and covers any new setting.)
- **FR-020**: The running application MUST offer a health check that says whether the frontend itself is serving, and reveals no configuration, secrets, or data. It MUST NOT depend on the backend, so a backend outage doesn't mark the frontend unhealthy.
- **FR-024**: Production errors MUST be observable through the container's console output only; no error-reporting service is added. The security review MUST confirm that this output can't hold patient data, clinical content, tokens, or query strings, and the documentation MUST say how IT staff read it.
- **FR-021**: The deployment documentation MUST cover building, configuring, starting, upgrading, and checking the application, and the full pre-production list in User Story 5.
- **FR-022**: Backend changes (trusted proxies, the draft version check) MUST be written up as requests for the backend's owner; no backend file may be changed.
- **FR-025**: Requests the application makes to the backend MUST pass on the client's network address exactly as the reverse proxy supplied it, so that once the backend trusts the application's address, its audit entries and sign-in limit see each computer separately (H2). The documentation MUST require the reverse proxy to replace, never append to, that address, and the application to be reachable only through the reverse proxy.

#### Clean-up

- **FR-023**: Every shared component without at least two real consumers outside the design preview MUST be removed or moved into its only consumer, unless a reason to keep it is recorded.

### Key Entities

- **Inactivity lock**: the state of one medical-record page: active or locked, the time of the last activity, and the person it belongs to. Exists only in that page's memory, never stored.
- **Security policy**: the set of browser instructions each response carries, and which part of the deployment sets each.
- **Journey**: a role's sequence of actions across screens, with its hand-offs to other roles, run per locale.
- **Review record**: a list of findings (security, accessibility, performance), each with its result and whether it was fixed or accepted, and by whom.
- **Pre-production item**: something that must be done outside this application before go-live, with its owner (backend, IT, legal).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of tested cases, a medical-record page left untouched for 5 minutes shows none of its content, and in 100% of tests, unlocking with the right password restores every unsaved character.
- **SC-002**: Unlocking takes a returning doctor under 10 seconds, typing their password once.
- **SC-003**: No request is sent by a locked page, and no audit entry other than the sign-in (and the previous session's sign-out) is written by locking or unlocking, as counted on the running API.
- **SC-004**: Every page and endpoint carries 100% of the required security headers, and every screen runs with zero policy violations in both languages and both themes.
- **SC-005**: Every role's journey passes in both languages against the running API, with the observed results recorded.
- **SC-006**: Zero automated accessibility violations at the AA level across every screen, both languages and both themes, and 100% of by-hand checklist items have a recorded result.
- **SC-007**: On a production build against the local API (standing in for the clinic's network), each role's main screens show their content within 2.5 seconds of opening and respond to a press within 200 milliseconds, for at least 75% of measurements. A screen that misses is fixed, or its reason is recorded and accepted by the owner.
- **SC-008**: Someone other than the author can build, configure, start, and health-check the application using only the documentation, in under one hour.
- **SC-009**: Every security finding is fixed or accepted in writing before the phase is accepted.

## Assumptions

- "Activity" means keyboard input, pointer movement or presses, scrolling, and touch on the medical-record page itself; activity in another tab or another application doesn't count.
- The lock is per tab. A tab not on a medical-record page never locks.
- The unlocking sign-in is recorded by the backend like any sign-in, which the owner accepted when choosing this design. Until trusted proxies are configured on the backend (H2), it also counts against the clinic's shared sign-in limit.
- Inline scripts are allowed (Clarifications), because neither a hash nor a per-request value can cover the streamed scripts while pages stay prerendered ([ADR 0006](../../docs/decisions/0006-cache-components.md)). ADR 0007's expectation of a hash or nonce is superseded by this phase's ADR.
- Strict transport security is set by the reverse proxy that terminates HTTPS, not by the application, which may also be reached over plain HTTP inside the host.
- No violation-reporting service is added; violations are found by testing before release.
- Performance targets are measured on a production build on the development machine against the local API, which stands in for the clinic's network; the clinic's real network is measured at go-live, outside this phase.
- The screen reader by-hand checks are done by the owner, as in earlier phases, and can't be automated.
- The legal review, managing browser extensions, the secret store, and the backend changes are outside this application and are delivered as documented items for their owners.
- Production configuration of the backend itself (its own image, database, backups) is the backend's concern and is out of scope.
- No new screen or business feature is added beyond the lock.
