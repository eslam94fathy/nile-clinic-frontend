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
| 6 | Appointments | **In progress** ([spec](../specs/006-appointments/spec.md)) | 4, 5 | Appointments, slots |
| 7 | Queue: reception and doctor | Not started | 6 | Queues |
| 8 | Medical encounters | Not started | 7 | Encounters |
| 9 | Billing and payments | Not started | 7 | Payments |
| 10 | Reports | Not started | 9 | Reports |
| 11 | Audit log | Not started | 3 | Audit |
| 12 | Role dashboards | Not started | 7, 8, 9, 10 | Composed |
| 13 | Hardening and production readiness | Not started | all | |

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
it gets a dedicated privacy review.

**9: Billing and payments.** Visits, charges, payments, administrator discount and refund.

**10: Reports.** Four reports; charting library decided here.

**11: Audit log.** Cursor paging with a `CursorPager` component, filters, search on explicit submit, because each search is recorded.

**12: Role dashboards.** Composed from the modules above, so these come last. Until then `/dashboard` is a
simple landing page.

**13: Hardening.** Full journeys per role and locale, accessibility and security review, security headers,
performance, deployment documentation, and the pre-production items below. A Content Security Policy must allow the fixed theme
script by hash or nonce ([ADR 0007](decisions/0007-design-system-foundation.md)). Also check for any shared component that still has
no real consumer, and remove it (the exception recorded in the Phase 2 plan).

## Decisions on open questions

The project owner approved these defaults on 2026-11-05. Any of them can be revisited.

| # | Question | Decision | Applies from |
|---|---|---|---|
| Q1 | Use the BFF, and later a small **backend** change to trust the proxy and keep real client IPs (H2)? | BFF. The backend change must be requested before production | Phase 3 |
| Q2 | Should a shared front-desk computer sign out after inactivity? Polling otherwise keeps the session alive indefinitely (H3). | No inactivity sign-out; polling only runs on visible tabs. The remaining risk is accepted | Phase 3 |
| Q3 | Default language, for visitors with no choice made? | Arabic, as the clinic is in Egypt; English one click away | Phase 1 |
| Q4 | How fresh must the queue be? | Poll every 15 seconds while visible | Phase 7 |
| Q5 | Brand and scope? (The API has no print endpoint, though a page can be printed.) | Original neutral clinical look, light and dark, no printing | Phase 2 |
| Q6 | Where will this be deployed? It decides the proxy setup in Q1. | Still open; decide by Phase 13 | Phase 13 |
| Q7 | May the backend gaps G1 and G2 be raised as backend work? | Work around them in the frontend | Phase 4 |

## Before production

From the backend's own roadmap and this analysis:

- Configure trusted proxies on the backend, or audit addresses and the sign-in limit are wrong (H2).
- Keep `CLINIC_TIMEZONE` the same in both applications (H4).
- Legal review of Egyptian health-data and data-protection obligations, including audit retention and whether
  network addresses are personal data. The backend has flagged this as outstanding.
- Session secret generated and stored in a secret manager; HTTPS everywhere.
