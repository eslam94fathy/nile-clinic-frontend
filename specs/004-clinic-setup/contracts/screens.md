# Contract: Screens

**A** administrator, **R** receptionist, **D** doctor. Every page wraps all its content in `<Suspense>` and `ScreenGate`, as in [the app shell contract](../../003-auth-app-shell/contracts/app-shell.md).

## Pages

| Address | Roles | Gate | Content | Empty state |
|---|---|---|---|---|
| `/staff` | A | `staff` | Role and status filters, table, "New account" | Offers to add; different text when filters are on |
| `/staff/new` | A | `staff` | Create form. `?role=doctor` preselects the role | |
| `/staff/[id]` | A | `staff` | Details and edit form, deactivate or reactivate, set password or a link to `/account`, "Create doctor profile" for active doctor-role accounts | |
| `/specialties` | A | `specialties` | Add form, list with both names, rename, deactivate, reactivate | Offers to add the first |
| `/doctors` | A R | `doctors` | Name, specialty, and status filters, table. "New doctor" for A | Different text when filters are on |
| `/doctors/new` | A | `doctors` + `manageDoctors` | No `account`: table of active doctor-role accounts. With `account`: the form | No accounts: links to `/staff/new?role=doctor`. No active specialties: links to `/specialties` |
| `/doctors/[id]` | A R | `doctors` | Readiness (A), profile, hours, slots, time off, fee. Controls for A only | Each section has its own |
| `/doctors/[id]/edit` | A | `doctors` + `manageDoctors` | Edit form | |
| `/doctors/[id]/schedule` | A | `doctors` + `manageSchedules` | Schedule editor, clear | All 7 days, no rows |
| `/fees` | A R | `fees` | Table, each row leading to the doctor | No doctors yet |
| `/my/schedule` | D | `my/schedule` | Own hours, slots, and time off, read-only. No fee | "An administrator sets working hours" |

Ids that aren't positive whole numbers give `notFound()` before any API call.

## `ScreenGate` change

```tsx
<ScreenGate locale={locale} path="doctors" capability="manageDoctors">
```

Optional. When given, a role without the capability gets `ForbiddenState`, and children aren't rendered or sent, exactly as for a route the role can't open.

## `ApiFailureState`

Server Component in `features/auth`, exported through `public-server`. Takes an `ApiError`.

| Status | Renders |
|---|---|
| `401` | `SessionEndRedirect` |
| `403` | `ForbiddenState` |
| `404` | `NotFoundState` |
| `422` or anything else | `ErrorState` with the API's message or general text, and `RetryButton` |

On `/doctors/[id]`, a `404` from the profile makes the whole page `NotFoundState`. A failure in another section stays in that section.

## Every change

| Requirement | How |
|---|---|
| Progress and no double submission | Pending state on the submit or dialog button, disabled until hydrated |
| Errors | `mapFieldErrors` for fields; `FormError` or the dialog's `error` for the rest |
| Success | Notice or status line, then `router.refresh()`, or navigation to the new record |
| `401` | `browserApi` ends the session and never settles |
| `403` | Notice with the API's message; `router.refresh()`, so the gate re-decides |
| `404` | `router.refresh()`, so the page shows `NotFoundState` |
| Passwords | `method="post"`, `autocomplete="new-password"`, `dir="ltr"`, cleared after any success |

## Confirmations

| Action | Must say |
|---|---|
| Deactivate an account | Ends that person's sessions, and they can't sign in |
| Deactivate one's own account | Also: you'll be signed out at once and can't sign back in |
| Move an account away from the doctor role | The doctor becomes inactive, and stops offering slots |
| Move one's own account away from administrator | You'll lose access to staff management and similar pages |
| Set a password | Ends that person's sessions |
| Deactivate a specialty | Assigned doctors keep it, and it can't be newly assigned |
| Clear a schedule | The doctor will offer no slots. Existing appointments aren't moved or cancelled, and reception will see affected ones flagged |
| Remove time off | The hours are offered again |

None of these is irreversible except by a further action, so `irreversible` isn't set. Schedule saves, time-off recording, and fee changes state their effects on the form rather than in a dialog, as they're routine and reversible by editing.

## Doctor's page sections

| Section | Empty | Controls (A) |
|---|---|---|
| Readiness | | Each incomplete item links to its step |
| Profile | | Edit |
| Hours | "No working hours set" | Set or change, leading to the editor |
| Slots | "No slots in the coming 31 days" | None |
| Time off | "None in this range" | Add form with the no-medical-details hint, remove |
| Fee | "No fee set" | Set or change form, with the note that existing charges keep their amount |

An inactive doctor also shows a notice that no slots are offered while the account is inactive or not a doctor.

## Translation keys

New namespaces in both files: `staff`, `specialties`, `doctors`, `scheduling`, `fees`, `days`. Days use `days.sunday` to `days.saturday`. Roles reuse `roles.*`. Specialty names choose `name_ar` or `name_en` by locale, except on the catalog, which shows both.
