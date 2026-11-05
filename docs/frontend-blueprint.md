# Frontend Blueprint

> **Status: approved direction; no screens are built yet.** What the product looks like, derived from the backend's
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
| `/staff`, `/staff/[id]` | A | Accounts, deactivate, set password | `/staff*` |
| `/specialties` | A | Catalog in both languages | `/specialties*` |
| `/doctors` | A R | Browse doctors | `GET /doctors` |
| `/doctors/[id]` | A R | Profile, schedule, time off, fee. Read-only for R | `/doctors/{id}`, `/schedule`, `/time-off`, `/fee` |
| `/fees` | A R | All fees | `GET /fees` |
| `/patients`, `/patients/[id]` | A R | Search, register, view, edit | `/patients*` |
| `/appointments`, `/appointments/[id]` | A R | Find, book, reschedule, cancel, no-show, check in | `/appointments*`, `/doctors/{id}/slots` |
| `/queue` | A R | Today's clinic queue, walk-ins, left, undo | `/queue*`, `/doctors/{id}/queue` |
| `/billing` | A R | A date's visits and balances, charge a visit | `GET /visits`, `POST /visits/{id}/charge` |
| `/charges`, `/charges/[id]` | A R | Find charges, payments. Discount and refund for A | `/charges*` |
| `/reports/*` | A | Money collected, billing, activity, times | `/reports/*` |
| `/audit` | A | Search the trail | `GET /audit-entries` |
| `/my/queue` | D | Own queue, call next, finish | `/doctors/me/queue*` |
| `/my/appointments` | D | Own appointments, read only | `/doctors/me/appointments*` |
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
found. Choose a doctor and date, then pick from free slots. On `409`, show why and refresh the slots.

**Arrival.** On today's appointment, check in. Without an appointment, add as a walk-in to a doctor's list.

**Doctor's visit.** Call next → the record opens for that patient → write → finish. Finishing and
finalizing are separate actions, and the API doesn't require a record to finish. The UI must make the
difference clear. The patient's permitted history sits alongside the record.

**Taking money.** From billing, charge the visit, then record the payment. Several payments are allowed
up to the balance. Payments can't be edited, so the amount and method must be confirmed first.

**Finalize.** The API returns any missing required fields against their inputs. Confirmation explains
that it can't be undone, and that corrections become addenda.

## Design system

Established in Phase 2, before feature screens.

**Direction.** Calm and clinical; dense enough for a front desk; high legibility in both scripts; light
and dark themes (Q5 in the roadmap). Final visual direction is proposed in Phase 2 for approval.

**Tokens.** Semantic CSS variables: surfaces, text, borders, primary, plus status tokens. Spacing,
radius, and type scales come from Tailwind's theme.

**Status.** One mapping per enum, used everywhere, always with a text label and never color alone.

| Tone | Appointment | Queue | Charge | Record |
|---|---|---|---|---|
| Neutral | `scheduled` | `waiting` | | `none` |
| Active | `checked_in` | `with_doctor` | `partially_paid` | `draft` |
| Success | `completed` | `seen` | `paid` | `finalized` |
| Warning | `no_show` | `left` | `unpaid` | |
| Muted | `cancelled` | | `cancelled` | |

**Typography.** A pairing that works for Arabic and Latin, chosen in Phase 2, self-hosted with `next/font`.

**Bidirectional content**

- Phone numbers, national IDs, money, and codes are wrapped to stay left-to-right inside Arabic text.
- User-written text such as names and clinical notes uses `dir="auto"`.
- Directional icons mirror in RTL; icons that aren't directional don't.
- Numeral style in Arabic (Western `123` or Eastern `١٢٣`) is one setting in `lib/format`, decided in Phase 2.

**Shared components** (built only when needed)

| Component | Purpose |
|---|---|
| `PageHeader` | Title, description, actions |
| `DataTable` | Server-paginated table with loading, empty, and error states |
| `CursorPager` | Audit log only, because it has no total |
| `FilterBar` | Filters synced to the URL |
| `StatusBadge` | The mapping above |
| `EmptyState`, `ErrorState`, `ForbiddenState` | Consistent states |
| `ConfirmDialog` | Destructive and irreversible actions |
| `FormField` wrappers | Label, hint, error; including the "no medical details" hint |
| `Money`, `ClinicDate`, `ClinicTime`, `Instant` | One correct display for each kind of value |
| `Can` | Role-based visibility |

**Lists.** Filters and page live in the URL so that they survive reload and the back button, with one
exception: patient details must not be put in the URL by the frontend beyond what search requires.
Whether name and phone search terms stay out of the page URL is settled in the patients spec.

**Responsive.** Reception and back office are desktop first, down to tablet. Doctor screens are also
usable on a tablet. Tables collapse to cards on narrow screens.

**Accessibility.** WCAG 2.2 AA, with focus returned after dialogs, errors announced, and data tables
with real headers.
