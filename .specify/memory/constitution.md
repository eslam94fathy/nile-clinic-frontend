# Nile Clinic Frontend Constitution

## Core Principles

### I. The Backend Is the Source of Truth

- Every endpoint, request field, response field, status, and error used by the frontend MUST be
  verified against the backend source or its OpenAPI contracts before it is used.
- Inventing an endpoint, field, or behavior is prohibited. A missing capability MUST be recorded as
  a gap in `docs/backend-integration.md` and raised with the project owner; it MUST NOT be faked.
- Backend business rules MUST NOT be re-implemented in the frontend. Client validation exists only
  to give faster feedback, and the backend's answer always wins.
- The backend repository MUST NOT be modified unless the project owner explicitly requests it.

Rationale: the API is finished, tested, and audited. A second copy of its rules can only disagree.

### II. Security and Patient Privacy by Design

- Authentication tokens MUST NOT be readable by browser JavaScript: never in `localStorage`,
  `sessionStorage`, IndexedDB, a non-HttpOnly cookie, a URL, or a response sent to the browser.
- Secrets and server configuration MUST NOT reach client code. Only deliberately public, non-secret
  values may use the `NEXT_PUBLIC_` prefix.
- Patient details, clinical content, tokens, and passwords MUST NOT be written to logs, analytics,
  error reports, URLs, query strings chosen by the frontend, or persistent browser storage.
  Backend search filters are the one exception, because the API defines them as query parameters.
- Responses holding patient or clinical data MUST NOT be stored in shared caches, and all client
  caches of them MUST be cleared at sign-out.
- Reads that the backend records in its audit trail MUST happen only as the direct result of a
  person's action. They MUST NOT be triggered by background refetching, window focus, retries after
  success, or link prefetching.
- Automated tests and fixtures MUST use synthetic data only.

Rationale: this is medical data, and the audit trail is a legal record. A spurious "opened" entry
is false evidence, so automatic refetching is a correctness bug here, not just a performance issue.

### III. Role-Based UI Is UX; the Backend Is the Boundary

- Navigation, routes, and actions MUST be shown according to the role permissions verified from the
  backend's policies, and this mapping MUST live in one place.
- Hiding UI MUST NOT be treated as security. Every screen MUST handle `401`, `403`, and `404` from
  the API correctly, whatever the UI believed the role could do.
- The staff roles are administrator, receptionist, and doctor. A patient-facing portal MUST NOT be
  built or assumed.

Rationale: roles can change while a session is open, so the UI's knowledge is always potentially
stale. Only the API can decide.

### IV. Feature-Based Modular Architecture

- Code MUST be organized by business feature, with UI, API integration, hooks, schemas, and types
  kept in separate, clearly named places.
- Presentation components MUST NOT call the network directly; API integration stays isolated behind
  a feature's API module.
- Features MUST NOT import each other's internals; shared code moves to a shared location only when
  a second real consumer exists.
- Server Components are the default. A Client Component MUST have a concrete reason: interaction,
  browser APIs, or client-side data fetching.

Rationale: each backend module maps to a feature, so a change stays local and reviewable.

### V. Strict Typing

- TypeScript `strict` mode MUST stay on. `any`, unexplained `as` casts, and `@ts-ignore` are
  prohibited; `unknown` plus narrowing is used at boundaries.
- API types MUST derive from the backend contracts, not be written from memory.
- Money from the API MUST be handled as strings and MUST NOT be converted to floating-point numbers
  for arithmetic or display.

Rationale: types are how contract drift is caught at build time rather than at the reception desk.

### VI. Every State Is Designed

- Every data-driven view MUST provide loading, error, empty, and success states.
- Every mutation MUST show progress, prevent accidental double submission, show the backend's
  translated error, and confirm success.
- Validation errors from the API MUST be mapped to their form fields; errors with no matching field
  MUST be shown at form level and MUST NOT be dropped.
- Irreversible actions MUST ask for confirmation and say that they cannot be undone.

Rationale: reception works under time pressure. An unexplained blank screen or a silent failure
costs patients time and can cause a double booking or a wrong payment.

### VII. Arabic and English, RTL and LTR, Accessible to All

- All user-facing text MUST come from translation files in both `en` and `ar` with identical keys.
  Hard-coded user-facing strings are prohibited.
- Layout MUST use logical properties so that it works in both directions. Both directions MUST be
  verified before a feature is complete.
- The active locale MUST be sent to the API as `Accept-Language`.
- Fixed API identifiers (statuses, roles, methods, days) MUST be translated by the frontend. Stored
  text (names, clinical notes) MUST be displayed exactly as written, never translated.
- Components MUST meet WCAG 2.2 AA: keyboard operation, visible focus, correct labels, sufficient
  contrast, and status never conveyed by color alone.

Rationale: the clinic works in both languages, and a clinical tool must be usable by all its staff.

### VIII. Tested Before Done

- A feature MUST NOT be reported complete until its tests have been run and have passed, with the
  actual results recorded. Tests MUST NOT be weakened to make a change pass.
- Unit and component tests cover logic and states. End-to-end tests cover critical journeys,
  per role, against the real API contract.
- Permission behavior and both locales MUST be covered wherever they affect the feature.

Rationale: "it should work" is not evidence.

### IX. Simplicity and Minimal Dependencies

- Every dependency MUST have a documented reason in `docs/tech-stack.md`, and is added only when a
  feature in progress needs it. Being on a list is not a reason to install it.
- Abstractions MUST wait for at least two real uses. Speculative layers, generic wrappers, and
  configuration for imagined needs are prohibited.

Rationale: every dependency is a supply-chain and upgrade cost in a system that holds medical data.

### X. Spec-Driven, Incremental, and Documented

- Every significant feature MUST follow Specify → Clarify → Plan → Tasks → Analyze → Implement →
  Test → Review, using the installed Spec Kit. The approved specification is the implementation
  contract.
- One phase MUST be completed and accepted before the next starts; future phases MUST NOT be
  implemented early.
- Architectural decisions MUST NOT be made silently. Each MUST be recorded as an ADR in
  `docs/decisions/` with its rationale. Documents MUST describe what is actually decided or built,
  and anything undecided MUST be labelled as such.
- Important unclear business requirements MUST be asked about, not assumed.

Rationale: this keeps a long project reviewable and keeps decisions recoverable.

## Technology & Security Constraints

- Foundation: Next.js App Router, React, TypeScript, Tailwind CSS, and shadcn/ui. Exact versions and
  the status of every other library are recorded in `docs/tech-stack.md`.
- The backend API is Laravel at `/api/v1`, using bearer tokens, documented in
  `docs/backend-integration.md`.
- Backend base URLs and session secrets are server-side configuration only.
- All clinic dates and times follow the backend's rules: wall-clock values are shown as sent, and
  UTC instants are shown in the clinic's time zone, never the browser's.
- Security-relevant dependencies and session handling changes require a recorded decision.

## Development Workflow & Quality Gates

A change is complete only when all of the following hold:

1. It traces to an approved spec and task.
2. Type checking, linting, and tests pass, and the results were actually observed.
3. All required states exist, in both languages and both directions.
4. Permissions were checked against the verified matrix, for each role.
5. No secret, token, or patient data can reach a log, URL, or persistent browser storage.
6. Any new dependency or architectural decision is documented.
7. Project documents reflect the change.

Commits are small and focused. Material conflicts between a spec and the backend stop the work and
are reported rather than assumed away.

## Governance

This constitution takes precedence over other project practices. `CLAUDE.md` and
`docs/development-guidelines.md` give day-to-day guidance and MUST NOT contradict it.

- **Amendments** require the project owner's approval, a stated rationale, and updates to any
  affected documents and in-progress plans.
- **Versioning** follows semantic versioning. MAJOR: a principle is removed or redefined
  incompatibly. MINOR: a principle or section is added or materially expanded. PATCH: clarification
  with no change in meaning.
- **Compliance** is checked in every plan's constitution check and at every review. A justified
  exception MUST be recorded in the plan's complexity tracking section.

**Version**: 1.0.0 | **Ratified**: 2026-11-05 | **Last Amended**: 2026-11-05
