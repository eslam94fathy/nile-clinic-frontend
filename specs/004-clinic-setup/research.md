# Research: Clinic Setup

Evidence comes from the backend at commit `dff2dca`, and from a spike on 2026-11-06. Anything marked **observed** was run, not assumed.

## R1. Reading and refreshing without a client cache

**Decision**: Pages read in Server Components through `serverApi`. Client Components change data through feature API modules and `browserApi`, then call `router.refresh()`. No TanStack Query in this phase.

**Rationale**: FR-037 needs changes to show without a manual reload. ADR 0006 notes that Cache Components keep visited routes mounted but hidden, so the question was whether a list opened before a change would show old data afterwards. A production-build spike tested it against the real API, with a server-rendered count on two pages and a client button changing a specialty's status.

| Step | Shown (immediately, and 1.5 s later) |
|---|---|
| 1. `/fees`, first visit | 28, 28 |
| 2. `/specialties`, by link | 28, 28 |
| 3. Change, then `router.refresh()` | 27, 27 |
| 4. Back to `/fees` by **link**, opened before the change | 27, 27 |
| 5. `/specialties`, by link | 27, 27 |
| 6. Change back, then `router.refresh()` | 28, 28 |
| 7. Back to `/fees` by **back button**, opened before the change | 28, 28 |

**Observed**: the hidden page never showed the old value. The first spike run also failed in strict mode because a locator matched two elements, which confirmed that the earlier page really is kept in the DOM. So the result isn't explained by the page having been removed.

**Alternatives**: TanStack Query, which `docs/tech-stack.md` plans for "first client query". This phase has no client query, since all reads can be on the server, and no polling. Installing it would break Principle IX. It stays planned for the queue's polling in Phase 7.

**Limit**: the spike covers changes made in this tab. A change made by someone else appears on the next load or navigation, which is normal.

## R2. Per-section failures on the doctor's page

**Decision**: The page's reads are each wrapped in React's `cache()` for the render. Every section sits in its own `<Suspense>`, reads its own result, and shows `ApiFailureState` on failure. The readiness summary reads the same cached results, so it makes no extra calls.

**Rationale**: FR-018 and the edge case on partial failure require that one failed read doesn't take down the page. Throwing to `error.tsx` would. `cache()` is already used this way by `getCurrentUser`, and never crosses requests or people.

**Alternatives**: One `Promise.all` in the page, which delays everything until the slowest answers.

## R3. Gating pages that only some of a route's roles may use

**Decision**: `ScreenGate` gains an optional `capability` prop, which narrows what the route's row allows. `/doctors/new` and `/doctors/[id]/edit` use the `doctors` row plus `capability="manageDoctors"`. `/doctors/[id]/schedule` uses `manageSchedules`.

**Rationale**: These pages are under a route that receptionists may open, but must send them no content (FR-033). A role check after the gate would repeat the gate's job at each use. Adding route rows would make the proxy and navigation consider addresses that aren't real destinations.

## R4. Choosing an account for a new doctor profile

**Decision**: `/doctors/new` with no `account` in the address shows a paged table of active doctor-role accounts, each with "Create profile" leading to `/doctors/new?account=<id>`. With `account`, the form reads that account and shows it as fixed text, along with a link to choose another. After creating an account with the doctor role, the application goes straight to that address.

**Rationale**: Gaps G1 and G2 mean that there's no name search and no way to tell which accounts already have a profile. An ordinary paged table handles any number of accounts, whereas a dropdown would have to load them all or lose the rest. The API's `422` on `user_id` is shown against the fixed account text. An id in the address is safe, as it identifies a staff account, not a patient.

**Details from source**: `user_id` is refused with that key for unknown, inactive, non-doctor, or already-linked accounts (`StoreDoctorRequest`, `DoctorService`). An inactive specialty gives `specialty_ids`.

**Alternatives**: A searchable combobox, which the API can't support without loading everything. Matching doctor names against account names to hide linked accounts, which is unreliable and which the spec rules out.

## R5. The schedule editor and its error keys

**Decision**: The form holds one flat `periods` array, rendered grouped by day. On submit it sends rows in on-screen order, Sunday to Saturday, so index N in an error is row N. `mapFieldErrors` receives each `periods.N`, `periods.N.start`, `periods.N.end`, and `periods.N.day` as known fields. Anything else goes to form level.

**Rationale**: Two kinds of key exist in `SetScheduleRequest`. Laravel's format rules produce `periods.N.start`, and the rules between periods, in `WeeklyScheduleRules`, produce `periods.N`. These never arrive together, since the second kind only runs when the first finds nothing. The API reports problems against the index it received, including overlaps, so the order sent is what makes the mapping correct.

**Quick feedback**: Time format and the limit of 4 periods per day, only. Overlap, order, and length checks stay with the API, so the application doesn't copy `WeeklyScheduleRules`.

**Details from source**: An empty `periods` is valid and leaves `appointment_minutes` set. Readiness therefore tests for periods, not for a length.

## R6. Entering times

**Decision**: A text input with `dir="ltr"`, `inputmode="numeric"`, and placeholder `HH:MM`, for schedule and time-off fields.

**Rationale**: `<input type="time">` can't hold `24:00`, which the API uses for the end of the day, and it displays in the browser's 12- or 24-hour style rather than as sent. A select with 288 options per field is heavy, with up to 28 periods on a page.

**Alternatives**: `type="time"` with a special "end of day" checkbox, which adds a concept that the API doesn't have.

## R7. Arabic-Indic digits

**Decision**: Fee and time fields convert `٠١٢٣٤٥٦٧٨٩` to Western digits before checking and sending. Nothing else is altered.

**Rationale**: Arabic is the default language, and staff on an Arabic keyboard layout can produce these digits. The API's patterns accept only Western digits, so these would otherwise be refused with a confusing message. Digits are already displayed as Western ([ADR 0008](../../docs/decisions/0008-visual-direction.md)). Registration numbers are excluded, as they're identifiers that the API restricts to Latin letters and digits.

## R8. Checking a fee without floats

**Decision**: Quick feedback uses a regular expression for the format (`^\d+(\.\d{1,2})?$`), then string checks. It's non-zero if any digit isn't `0`. It's within the limit if the integer part, without leading zeros, has under 6 digits, or is exactly `100000` with zero decimals. The string is sent as typed, after digit conversion.

**Rationale**: `AmountInput` is above 0, at most 100000, and at most two decimals. Principle V prohibits floats for money, and this needs no arithmetic.

## R9. The clinic's today

**Decision**: `lib/format/clinic-today.ts` provides a pure `clinicToday(timeZone, now)` using `Intl.DateTimeFormat` with the `en-CA` calendar parts, and `addDays(date, count)` using `Date.UTC` arithmetic on the parts. Pages call it on the server with `getEnv().CLINIC_TIMEZONE`.

**Rationale**: Hazard H4: no endpoint gives the clinic's today. Slots refuse a `from` before it, so the wrong value is a `422`. Only the server reads the time zone setting.

**Ranges used** (from `ListSlotsRequest`, `ListTimeOffRequest`):

| Read | Range | Limit in source |
|---|---|---|
| Slots | today to today + 30 | `diffInDays + 1 <= 31`, inclusive; 90-day horizon |
| Time off, default | today to today + 366 | `diffInDays <= 366` |

A slots request crossing the clinic's midnight may send a `from` that has just passed and get a `422`, which the section shows as an ordinary failure with a retry.

## R10. Showing slots

**Decision**: The section gives the number of slots in the 31 days, and lists the first 7 dates that have slots, with their start times. Nothing is computed beyond grouping by the API's `date`.

**Rationale**: A 20-minute schedule can give 500 slots in 31 days. Showing all of them gives no benefit in a setup screen, and booking is what will use them in Phase 6.

## R11. Own-account actions

**Decision**: The staff page compares the account's id with the signed-in person's id, on the server. On their own account, it replaces password reset with a link to `/account`, and adds the loss-of-access sentence to the deactivate and role-change confirmations. After success, `router.refresh()` lets the gate apply the normal rules: a deactivated person's `401` ends the session, and a demoted person sees "not allowed".

**Details from source**: `StaffManagementService` allows both unless the account is the last active administrator (`LastAdministratorException`, `message` only, no `errors`, so it's shown at form or dialog level). `setPassword` deletes all of the account's tokens, including the caller's, which is why the owner chose the link.

## R12. Specialty choices

**Decision**: A `fieldset` of native checkboxes with a `legend`, using `accent-primary`, in `features/doctors`. Create lists active specialties. Edit lists active ones plus the doctor's assigned ones, with a "deactivated" label on those.

**Rationale**: `specialty_ids` is a set, and the catalog is small. Native inputs need no new generated component and work with React Hook Form directly. `ensureAssignable` confirms that an assigned, deactivated specialty may stay.

## R13. Audit check

**Decision**: No read in this phase is audited. **Checked** against the list in `docs/backend-integration.md` H1 and ADR 0005: staff, specialties, doctors, schedules, slots, time off, and fees are all absent. Writes here do leave audit entries, as a person's real actions should. No special handling applies.
