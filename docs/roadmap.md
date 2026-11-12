# Roadmap

One phase at a time, each accepted before the next starts. From Phase 3 on, each phase runs the full
Spec Kit cycle and gets its own `specs/NNN-*` directory. Phases 1 and 2 also use Spec Kit, as they set
foundations that later work relies on.

| Phase | Name | Status | Depends on | Backend |
|---|---|---|---|---|
| 0 | Discovery and architecture | **Done** (approved 2026-11-05) | | all |
| 1 | Project foundation | **Done** (accepted 2026-11-06, [spec](../specs/001-project-foundation/spec.md)) | 0 | `/health` |
| 2 | Design system | **Done** (accepted 2026-11-06, [spec](../specs/002-design-system/spec.md)) | 1 | |
| 3 | Authentication and app shell | **Done** (accepted 2026-11-06, [spec](../specs/003-auth-app-shell/spec.md)) | 2 | Auth |
| 4 | Clinic setup: staff, specialties, doctors, schedules, fees | **Done** (accepted 2026-11-06, [spec](../specs/004-clinic-setup/spec.md)) | 3 | Staff, Doctors, Scheduling, fee endpoints |
| 5 | Patients | **Done** (accepted 2026-11-06, [spec](../specs/005-patients/spec.md)) | 3 | Patients |
| 6 | Appointments | **Done** (accepted 2026-11-07, [spec](../specs/006-appointments/spec.md)) | 4, 5 | Appointments, slots |
| 7 | Queue: reception and doctor | **Done** (accepted 2026-11-07, [spec](../specs/007-queue/spec.md)) | 6 | Queues |
| 8 | Medical encounters | **Done** (accepted 2026-11-08, [spec](../specs/008-medical-encounters/spec.md), [privacy review](../specs/008-medical-encounters/privacy-review.md)) | 7 | Encounters |
| 9 | Billing and payments | **Done** (accepted 2026-11-08, [spec](../specs/009-billing-payments/spec.md)) | 7 | Payments |
| 10 | Reports | **Done** (accepted 2026-11-10, [spec](../specs/010-reports/spec.md); charting library: none, [ADR 0017](decisions/0017-charts-without-a-library.md)) | 9 | Reports |
| 11 | Audit log | **Done** (accepted 2026-11-11, [spec](../specs/011-audit-log/spec.md), [ADR 0018](decisions/0018-audit-search-on-press.md)) | 3 | Audit |
| 12 | Role dashboards | **Done** (accepted 2026-11-11, [spec](../specs/012-role-dashboards/spec.md), [ADR 0019](decisions/0019-dashboards-read-in-panels.md)) | 7, 8, 9, 10 | Composed |
| 13 | Hardening and production readiness | **Done** (accepted 2026-11-12, [spec](../specs/013-hardening/spec.md), ADRs [0020](decisions/0020-inactivity-lock.md), [0021](decisions/0021-security-headers.md), [0022](decisions/0022-deployment.md)) | all | |

## Phase details

**0: Discovery and architecture.** Backend analysis, documents, ADRs, constitution. No application code.

**1: Project foundation.** Next.js scaffold, strict TypeScript, linting, validated environment,
`next-intl` routing with `dir`, Vitest and Playwright running with one real test each, generated API
types, git, and CI if wanted. *Done when* `/en` and `/ar` render with the right direction, a server call
to `/health` works against the Docker API, and all checks pass.

**2: Design system.** Visual direction for approval, tokens, Arabic and Latin typography, shadcn setup
with RTL, shared components, and a private preview route. *Done when* every shared component is
demonstrated in both directions and themes, with accessibility checks passing.

**3: Authentication and app shell.** BFF, sealed session, sign-in, sign-out, session expiry, proxy,
permissions map, the `Can` component, role navigation, `403`, `404`, doctor-without-profile, and change password. Also confirms
pagination `meta` on the live API. *Done when* each role signs in and sees only its navigation, the token
is proven absent from browser-reachable places, and expired or deactivated sessions are handled.

**4: Clinic setup.** Everything that must exist before booking, and the doctor's read-only "My schedule", as no other phase covers
those endpoints. *Done when* an administrator can take a new doctor from account to bookable, with a fee.

**5: Patients.** Search with Arabic-aware API matching, register, view, edit. Audited reads apply.

**6: Appointments.** Booking with slots, conflicts, reschedule, cancel, no-show, outside-availability. Check-in moved to Phase 7, as the API places it with the queue.

**7: Queue.** Check-in on an appointment's page, reception's live list, and the doctor's call-next and finish flow, with polling.

**8: Medical encounters.** Draft, save strategy, finalize, addenda, history. The most sensitive phase, and
it gets a dedicated privacy review. Started from the Phase 7 branch, as that PR wasn't merged yet.

**9: Billing and payments.** Visits, charges, payments, administrator discount and refund.

**10: Reports.** Four reports; charting library decided here.

**11: Audit log.** Cursor paging with a `CursorPager` component, filters, search on explicit submit, because each search is recorded.

**12: Role dashboards.** Composed from the modules above, so these come last. Until then `/dashboard` is a
simple landing page.

**13: Hardening.** Full journeys per role and locale, accessibility and security review, security headers,
performance, deployment documentation, and the pre-production items below. A Content Security Policy must allow the fixed theme
script by hash or nonce ([ADR 0007](decisions/0007-design-system-foundation.md)). Also check for any shared component that still has
no real consumer, and remove it (the exception recorded in the Phase 2 plan). Count `CursorPager`, shared with one consumer (Phase 11's plan), and the "not available yet" placeholder, which no route uses since Phase 11.

## Decisions on open questions

The project owner approved these defaults on 2026-11-05. Any of them can be revisited.

| # | Question | Decision | Applies from |
|---|---|---|---|
| Q1 | Use the BFF, and later a small **backend** change to trust the proxy and keep real client IPs (H2)? | BFF. The backend change must be requested before production | Phase 3 |
| Q2 | Should a shared front-desk computer sign out after inactivity? Polling otherwise keeps the session alive indefinitely (H3). | No inactivity sign-out; polling only runs on visible tabs. The remaining risk is accepted | Phase 3 |
| Q3 | Default language, for visitors with no choice made? | Arabic, as the clinic is in Egypt; English one click away | Phase 1 |
| Q4 | How fresh must the queue be? | Poll every 15 seconds while visible | Phase 7 |
| Q5 | Brand and scope? (The API has no print endpoint, though a page can be printed.) | Original neutral clinical look, light and dark, no printing | Phase 2 |
| Q6 | Where will this be deployed? It decides the proxy setup in Q1. | A Docker image running the Node server, behind a reverse proxy that terminates HTTPS, beside the backend's Docker Compose, so the backend trusts one known proxy address (decided 2026-11-11) | Phase 13 |
| Q7 | May the backend gaps G1 and G2 be raised as backend work? | Work around them in the frontend | Phase 4 |

## Before production

Moved in Phase 13 to [docs/deployment.md](deployment.md#before-production), where each item has its owner and status, with the backend's
part written up as requests in [specs/013-hardening/backend-requests.md](../specs/013-hardening/backend-requests.md). Every item that was
listed here is there: trusted proxies on the backend (H2), the same `CLINIC_TIMEZONE` in both applications (H4), the legal review with
Phase 8's privacy review questions, the session secret in a secret store and HTTPS everywhere, the inactivity lock for clinical pages (built
in Phase 13), the draft version check (G9), and managing browser extensions on clinic computers.
