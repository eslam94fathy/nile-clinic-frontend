# Feature Specification: Project Foundation

**Feature Branch**: `001-project-foundation`

**Created**: 2026-11-05

**Status**: Accepted

**Input**: User description: "Project foundation (roadmap Phase 1) for the Nile Clinic staff frontend. Establish the runnable, verified skeleton that all later features build on, with no business screens. Scope: scaffold with strict typing, linting and formatting; validated server-side configuration (backend API address, clinic time zone); Arabic (default) and English routing with correct language and direction; a minimal landing page in both languages showing backend connectivity from a server-side check, including the unavailable state; committed snapshot of the backend's API contracts with generated types; unit, component, and end-to-end tests running with real tests; setup documentation. Done when both languages render in the correct direction, the server-side health check works against the running backend, and all checks pass. Out of scope: design system, authentication, proxy to the backend for browser calls, data-fetching library, forms, any feature screen, and any backend modification."

## Clarifications

### Session 2026-11-05

No questions were needed; approved project defaults apply. Two statements were corrected during planning, after a production spike showed the framework's behavior without JavaScript (see `research.md`, R3 and R4).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open the application in the right language and direction (Priority: P1)

A staff member opens the application. It appears in Arabic, laid out right to left, unless they have previously chosen English. They can switch language in one action and stay on the same page, and their choice is remembered on their next visit.

**Why this priority**: Every later screen depends on language and direction being correct from the first render. Retrofitting this later would touch everything.

**Independent Test**: Open the application's address with no prior choice, confirm Arabic and right-to-left, switch to English, confirm left-to-right, return to the bare address, and confirm English is remembered.

**Acceptance Scenarios**:

1. **Given** a visitor with no saved choice, **When** they open the bare address, **Then** they arrive at the Arabic version, whatever language their browser prefers.
2. **Given** the Arabic address, **When** the page renders, **Then** the document declares language Arabic and direction right-to-left, and all visible text is Arabic.
3. **Given** the English address, **When** the page renders, **Then** the document declares language English and direction left-to-right, and all visible text is English.
4. **Given** any page, **When** the visitor uses the language switch, **Then** they see the same page in the other language.
5. **Given** a visitor who chose English earlier, **When** they open the bare address, **Then** they arrive at the English version.
6. **Given** an address whose first segment is not exactly a supported language (such as `/fr` or `/AR`), **When** it is opened in a browser, **Then** a not-found page appears in the visitor's saved language, otherwise the default language.

---

### User Story 2 - See whether the clinic system is reachable (Priority: P1)

Anyone opening the landing page sees a plain statement of whether the clinic's backend system is working, in their language, along with the time of the check in the clinic's time zone. If it isn't working, they see which of the known situations applies and can check again, with no technical details exposed.

**Why this priority**: It proves the whole chain works end to end (application server to backend, in both languages), which is the phase's main evidence, and gives setup and support a quick diagnostic.

**Independent Test**: With the backend running, open the page and see the working state. Point the configuration at a wrong address and see the unreachable state.

**Acceptance Scenarios**:

1. **Given** the backend reports it is healthy, **When** the page is opened, **Then** a "working" status appears with the check time in the clinic's time zone.
2. **Given** the backend reports that its database is unavailable, **When** the page is opened, **Then** a "system unavailable" status appears, distinct from "cannot reach".
3. **Given** the backend cannot be reached, or doesn't answer in time, **When** the page is opened, **Then** a "cannot reach the system" status appears within 5 seconds, plus rendering time.
4. **Given** something other than the backend answers at the configured address, **When** the page is opened, **Then** it is treated as "cannot reach the system" and never as "working".
5. **Given** any non-working status, **When** the visitor chooses to check again, **Then** a new check runs and the status updates.
6. **Given** a slow check, **When** the page is loading, **Then** the rest of the page is visible with a clear "checking" status.
7. **Given** any status, **When** the visitor inspects what reached their browser, **Then** the backend's address does not appear, and the browser made no direct call to the backend.

---

### User Story 3 - Trust a single set of quality checks (Priority: P2)

A developer runs one command that performs every quality check: types, code rules, formatting, translation completeness, contract types being up to date, and automated tests. It fails when a project rule is broken.

**Why this priority**: The constitution's rules only hold if they're enforced automatically. They should be in place before the first feature.

**Independent Test**: Run the command on a clean checkout and see it pass. Introduce a violation for each rule and see it fail.

**Acceptance Scenarios**:

1. **Given** a clean checkout, **When** the checks run, **Then** all pass.
2. **Given** an untyped escape hatch in code, **When** the checks run, **Then** they fail.
3. **Given** a translation key present in only one language, **When** the checks run, **Then** they fail and name the key.
4. **Given** a physical left or right style instead of a logical one, **When** the checks run, **Then** they fail.
5. **Given** a broken behavior in either language, **When** the end-to-end tests run, **Then** they fail.

---

### User Story 4 - Build on API types that come from the contracts (Priority: P2)

A developer implementing a feature uses types derived from the backend's published contracts rather than writing them from memory. The snapshot records which backend version it came from, and refreshing it is one deliberate step.

**Why this priority**: The rule that nothing about the API may be invented needs a mechanism. Every feature from Phase 3 on relies on it.

**Independent Test**: Use a generated type for the health response on the landing page, then change a local copy of a contract and confirm the check for up-to-date types fails.

**Acceptance Scenarios**:

1. **Given** the repository, **When** a developer looks for the contracts, **Then** all 11 are present, with the backend version they came from recorded.
2. **Given** the snapshot, **When** types are generated, **Then** each contract's types are available and the output matches what is committed.
3. **Given** a changed contract and stale generated types, **When** the checks run, **Then** they fail.
4. **Given** a newer backend, **When** a developer runs the refresh step with a path to a backend checkout, **Then** the snapshot, its recorded version, and the types are updated, and the differences are visible for review.

---

### User Story 5 - Set up the project from the documentation (Priority: P3)

A new developer follows the README and has the application running against a local backend. Missing or invalid configuration produces an immediate, clear message rather than strange behavior later.

**Why this priority**: It keeps the project reproducible, but the project can technically proceed without it.

**Independent Test**: Follow the README from a fresh checkout; separately, start with a missing and with an invalid configuration value.

**Acceptance Scenarios**:

1. **Given** a fresh checkout and a running backend, **When** the developer follows the README, **Then** the application runs and shows the working status.
2. **Given** a missing or invalid configuration value, **When** the application starts, **Then** it stops with a message naming the setting and what is expected, without printing any setting's value.
3. **Given** a backend on a non-default local port, **When** the developer sets the address, **Then** the application uses it.

---

### Edge Cases

- The backend returns an unexpected status or a body that isn't the documented shape: treated as "cannot reach the system".
- The backend answers `200` with a body reporting anything other than `ok`: not reported as working.
- The configured backend address has a trailing slash: it still works.
- A language segment in unexpected case, such as `/AR`: not treated as a supported language.
- JavaScript is disabled: on the landing page, language, direction, and page text still come from the server's first response. The status can't complete without JavaScript, so a translated notice says so. Not-found pages need JavaScript to display. This is verified framework behavior and acceptable for an internal application that will require JavaScript from Phase 3.
- The language switch is used while a check is in progress: the page still loads in the new language.
- A saved language choice holds an unsupported value: the default language applies.

## Requirements *(mandatory)*

### Functional Requirements

**Language and direction**

- **FR-001**: The application MUST serve every page under an address that identifies its language, for Arabic and English only.
- **FR-002**: A bare address MUST go to the visitor's saved choice, otherwise Arabic. Browser language preferences MUST NOT affect this.
- **FR-003**: The document's declared language and direction MUST match the address on the first response from the server.
- **FR-004**: Visible text MUST come from translation files for both languages, with identical keys. Hard-coded visible text is not allowed.
- **FR-005**: Users MUST be able to switch language in one action from any page, staying on the same page. The choice MUST be remembered, and MUST hold no personal data.

**Connectivity status**

- **FR-006**: The landing page MUST show one of four statuses: checking, working, system unavailable, or cannot reach the system.
- **FR-007**: The check MUST run on the application server, once per page request, and its result MUST NOT be cached or statically generated.
- **FR-008**: The check MUST give up after 5 seconds.
- **FR-009**: "Working" MUST be shown only when the backend's response matches its documented healthy response. A documented unavailable response MUST show "system unavailable". Anything else MUST show "cannot reach the system".
- **FR-010**: Non-working statuses MUST offer a way to check again.
- **FR-011**: The working status MUST show the check time in the clinic's configured time zone, regardless of the browser's time zone.
- **FR-012**: Status MUST be conveyed in text and exposed to assistive technology, not by color alone.

**Configuration and safety**

- **FR-013**: Backend address and clinic time zone MUST be server-side settings, validated when the application starts, and never sent to the browser.
- **FR-014**: The clinic time zone MUST default to the backend's documented default, `Africa/Cairo`. It MUST be rejected if it isn't a valid time zone.
- **FR-015**: Invalid configuration MUST stop startup with a message naming the setting, without printing values.
- **FR-016**: Code intended for the server MUST fail the build if imported into browser code.
- **FR-017**: The repository MUST ignore real environment files, and MUST provide an example file holding placeholders only.
- **FR-018**: Application logs MUST NOT contain the content of backend responses or settings' values.

**Quality and contracts**

- **FR-019**: One command MUST run all quality checks and report failure with a non-zero result.
- **FR-020**: The checks MUST reject untyped escape hatches, physical direction styles, unformatted code, mismatched translation files, and out-of-date generated types.
- **FR-021**: Automated tests MUST run at unit, component, and end-to-end levels, with real tests at each level. End-to-end tests MUST cover both languages and all connectivity statuses.
- **FR-022**: The repository MUST contain a read-only snapshot of all 11 backend contracts, the backend version it came from, types generated from it, and a single refresh step.
- **FR-023**: The landing page's handling of the health response MUST use a generated contract type.

**Documentation**

- **FR-024**: The README MUST cover prerequisites, setup, configuration, running, testing, and refreshing contracts, and MUST be verified by following it.
- **FR-025**: Project documents MUST be updated to match what was built, including exact dependency versions and any local port differences.

**Scope limits**

- **FR-026**: This feature MUST NOT include a component library or design system, authentication, a browser-to-backend proxy, a client data-fetching library, forms, or feature screens. Styling is limited to what makes the page readable in both directions.
- **FR-027**: This feature MUST NOT modify the backend.

### Key Entities

- **Connectivity status**: The result of one server-side check: checking, working, system unavailable, or cannot reach the system, plus the time of the check.
- **Contract snapshot**: The 11 contract files and the backend version they came from.
- **Language choice**: The visitor's saved preference, Arabic or English, with no link to a person.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The landing page renders in the correct language and direction in the server's first response, in both languages, with JavaScript disabled. Every page, including not-found pages, shows the correct language and direction with JavaScript enabled.
- **SC-002**: All three non-loading statuses are demonstrated against real conditions: the running backend for "working", and real or faithfully simulated responses for the other two.
- **SC-003**: The status appears within 5 seconds of the page being requested when the backend doesn't answer, plus rendering time.
- **SC-004**: A developer following only the README reaches a running application in under 15 minutes, given a running backend and installed prerequisites.
- **SC-005**: All quality checks run from one command, in under 5 minutes, and each listed rule violation is demonstrated to fail them.
- **SC-006**: A search of everything sent to the browser finds zero occurrences of the backend address.
- **SC-007**: Both languages pass automated accessibility checks on the landing page with zero serious or critical issues.

## Assumptions

- The users of this phase's page are staff and developers. It is a temporary landing page, to be replaced by the signed-in home in Phase 3. It is public, like the backend's health endpoint, and shows no patient data.
- The backend runs locally through its Docker setup. Its port differs per machine: the documented default is 8080, while this machine uses 8081. So the address is configuration, never assumed.
- Light and dark themes are established in Phase 2; this phase needs only readable default styling.
- The approved decisions in `docs/decisions/` and `docs/tech-stack.md` set the technology. They are not re-decided here.
- The snapshot is taken from the backend commit recorded in `docs/backend-integration.md`, or a newer one if it has moved. Any differences are reviewed first.
- Continuous integration needs a remote repository, which doesn't exist yet. It is therefore out of scope, and the single check command is what a pipeline would later run.
