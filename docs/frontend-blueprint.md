# Frontend Blueprint

> **Status: approved direction; the design system, app shell, clinic setup, patients, appointments, and the queue exist.** What the product looks like, derived from the backend's
> capabilities. Each screen is confirmed in its feature's specification. Everything below maps to
> verified endpoints in [backend-integration.md](backend-integration.md).

## Users and their day

| Role | Works on | Primary need |
|---|---|---|
| **Receptionist** | Front-desk computer, all day, under time pressure | Find a patient, book, check in, take payment, as quickly as possible |
| **Doctor** | Consulting room, between patients | See who's next, call them, write the record |
| **Administrator** | Back office | Set up staff, doctors, schedules, and fees; review money, activity, and the audit trail. Can also do reception work, but never sees clinical content |

## Routes

All routes sit under `/{locale}` (`en` or `ar`). **A** administrator, **R** receptionist, **D** doctor.

| Route | Roles | Purpose | Main endpoints |
|---|---|---|---|
| `/sign-in` | public | Sign in; "forgot password" points to an administrator | `POST /auth/sign-in` |
| `/dashboard` | A R D | Role-specific home | see below |
| `/account` | A R D | Own profile, change password | `GET /auth/me`, `PUT /auth/password` |
| `/staff`, `/staff/new`, `/staff/[id]` | A | Accounts, deactivate, set password | `/staff*` |
| `/specialties` | A | Catalog in both languages | `/specialties*` |
| `/doctors` | A R | Browse doctors | `GET /doctors` |
| `/doctors/new`, `/doctors/[id]/edit`, `/doctors/[id]/schedule` | A | Create and edit a profile, set hours | `/doctors*`, `/staff`, `/schedule` |
| `/doctors/[id]` | A R | Profile, schedule, time off, fee. Read-only for R | `/doctors/{id}`, `/schedule`, `/time-off`, `/fee` |
| `/fees` | A R | All fees | `GET /fees` |
| `/patients`, `/patients/new`, `/patients/[id]` | A R | Search, register, view, and edit on the record's own page | `/patients*` |
| `/appointments`, `/appointments/new`, `/appointments/[id]` | A R | Find, book, reschedule, cancel, no-show, and check in on the appointment's page | `/appointments*`, `/doctors/{id}/slots` |
| `/queue` | A R | Today's clinic queue, left, undo | `GET /queue`, `/queue/{entry}*`, `/doctors/{id}/queue` |
| `/queue/walk-in` | A R | Add a walk-in, with a patient carried from their page | `POST /queue/walk-ins` |
| `/billing` | A R | A date's visits and balances, charge a visit | `GET /visits`, `POST /visits/{id}/charge` |
| `/charges`, `/charges/[id]` | A R | Find charges, payments. Discount and refund for A | `/charges*` |
| `/reports/*` | A | Money collected, billing, activity, times | `/reports/*` |
| `/audit` | A | Search the trail | `GET /audit-entries` |
| `/my/queue` | D | Own queue, call next, finish | `/doctors/me/queue*` |
| `/my/appointments`, `/my/appointments/[id]` | D | Own appointments, read only | `/doctors/me/appointments*` |
| `/my/schedule` | D | Own hours and time off, read only | `/doctors/me/schedule`, `/slots`, `/time-off` |
| `/my/visits` | D | Past visits, including those needing a record | `/doctors/me/visits` |
| `/my/encounters/[id]` | D | Write, finalize, add addenda | `/doctors/me/encounters/*` |
| `/my/patients/[id]/history` | D | A patient's permitted records | `/doctors/me/patients/{id}/encounters` |

There is deliberately no patient-portal route, no doctor patient directory (the API refuses it), and no
clinical screen for administrators or receptionists.

The API also lets doctors read `/doctors` and `/specialties`. Whether they need a screen for it is left
out unless a need appears.

## Navigation

| Administrator | Receptionist | Doctor |
|---|---|---|
| Dashboard | Dashboard | Dashboard |
| Patients | Patients | My queue |
| Appointments | Appointments | My appointments |
| Queue | Queue | My visits |
| Billing, Charges | Billing, Charges | My schedule |
| Doctors, Specialties, Fees | Doctors, Fees | |
| Staff | | |
| Reports | | |
| Audit log | | |

Language switch, account, and sign-out appear in the top bar for everyone.

## Dashboards

No summary endpoint exists, so each is composed from existing endpoints and shows only what they return.

| Role | Content | Source |
|---|---|---|
| Administrator | Today's money and activity, upcoming appointments outside availability | `/reports/money-collected`, `/reports/activity`, `/appointments?outside_availability=true` |
| Receptionist | Today's appointments and arrivals, queue by status, unpaid visits, appointments needing a move | `/appointments`, `/queue`, `/visits?date=today`, `/appointments?outside_availability=true` |
| Doctor | Patient with me now, waiting count, next patients, visits lacking a record | `/doctors/me/queue`, `/doctors/me/appointments`, `/doctors/me/visits?record_status=none` |

Counts come from `meta.total` or the returned list, never from fetching everything. Each dashboard is
specified after the modules it draws on.

## Key workflows

**Book.** Find the patient by name, phone, national ID, or number; registering is one step away if not
found. Choose a doctor, then pick from seven days of free times. On a refusal about the time, show why, read the free times again,
and keep the patient, doctor, and note. Choosing a patient never opens their record, so it writes no audit entry.

**Arrival.** On today's appointment's page, check in, which gives a queue number and needs no confirmation, as it can be undone from the queue. Without an appointment, add as a walk-in to a doctor's list, which can't be removed afterwards, only marked as left.

**Doctor's visit.** Call next → the record opens for that patient → write → finish. Finishing and
finalizing are separate actions, and the API doesn't require a record to finish. The UI must make the
difference clear. The patient's permitted history sits alongside the record.

**Taking money.** From billing, charge the visit, then record the payment. Several payments are allowed
up to the balance. Payments can't be edited, so the amount and method must be confirmed first.

**Finalize.** The API returns any missing required fields against their inputs. Confirmation explains
that it can't be undone, and that corrections become addenda.

## Design system

Established in Phase 2, before feature screens.

**Direction.** "Still water": deep river teal on a cool, quiet ground, with open ruled rows and light and dark themes. Approved
in [ADR 0008](decisions/0008-visual-direction.md), which holds the token values.

**Tokens.** Semantic CSS variables: surfaces, text, borders, primary, plus status tokens, which `pnpm check:contrast` enforces.
Spacing, radius, and type scales come from Tailwind's theme.

**Status.** One mapping per enum, used everywhere, always with a text label and never color alone.

| Tone | Appointment | Queue | Charge | Record |
|---|---|---|---|---|
| Neutral | `scheduled` | `waiting` | `none` (visit lists) | `none` |
| Active | `checked_in` | `with_doctor` | `partially_paid` | `draft` |
| Success | `completed` | `seen` | `paid` | `finalized` |
| Warning | `no_show` | `left` | `unpaid` | |
| Muted | `cancelled` | | `cancelled` | |

**Typography.** IBM Plex Sans and IBM Plex Sans Arabic, self-hosted with `next/font`.

**Dates and times.** Clinic dates and wall-clock times appear literally as sent, such as `2026-11-08` and `09:20`. Moments in time use a
localized format in the clinic's time zone, so the two kinds look different by design.

**Bidirectional content**

- Phone numbers, national IDs, money, and codes are wrapped to stay left-to-right inside Arabic text.
- User-written text such as names and clinical notes uses `dir="auto"`.
- Directional icons mirror in RTL; icons that aren't directional don't.
- Digits in Arabic are Western (`123`), set in one place in `lib/format` ([ADR 0008](decisions/0008-visual-direction.md)).

**Shared components.** Built in Phase 2, and all demonstrated at the private `/design-preview`. Their contract is in
[the Phase 2 spec](../specs/002-design-system/contracts/shared-components.md).

| Component | Purpose |
|---|---|
| `PageHeader` | Title, description, actions |
| `DataTable` | Server-paginated table with loading, empty, and error states; cards on narrow screens |
| `FilterBar` | Filters applied on submit. Each filter must state whether it goes in the URL |
| `StatusBadge` | The mapping above |
| `LoadingState`, `EmptyState`, `ErrorState`, `ForbiddenState`, `NotFoundState` | Consistent states |
| `ConfirmDialog` | Destructive and irreversible actions |
| `FormField`, `FormError` | Label, hint, error; including the "no medical details" hint |
| `Notices` | Success and failure messages |
| `Money`, `ClinicDate`, `ClinicTime`, `Instant`, `LtrText`, `UserText` | One correct display for each kind of value |
| `ThemeSwitch` | Light, dark, or following the device |

Phase 3 added `Can` for role-based visibility, in `features/app-shell`, and Phase 4 gave it consumers. Phase 4 also added `ConfirmedAction`, a button that asks first, calls the API, and refreshes. Still to come: `CursorPager` for the
audit log, the only list with no total (Phase 11).

**Lists.** Filters and page live in the URL so that they survive reload and the back button, with one
exception: patient search, including where it's used to choose a patient. Its terms and page stay in the component's state and out of the
address, so a reload clears them, and going back restores them while the page is held
([ADR 0012](decisions/0012-audited-reads-in-the-browser.md)). The patient number may be in an address, as the appointment list's filter does.

**Responsive.** Reception and back office are desktop first, down to tablet. Doctor screens are also
usable on a tablet. Tables collapse to cards on narrow screens.

**Accessibility.** WCAG 2.2 AA, with focus returned after dialogs, errors announced, and data tables
with real headers.
