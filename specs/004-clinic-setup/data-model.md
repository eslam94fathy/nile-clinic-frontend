# Data Model: Clinic Setup

The frontend stores nothing. These are views over the API's data, and form shapes. API types come from `lib/api/generated` and are named in each feature's `types.ts`.

## API entities

| Entity | Generated type | Fields used | Notes |
|---|---|---|---|
| Staff member | `staff-auth` `StaffMember` | `id`, `name`, `email`, `role`, `is_active`, `created_at`, `updated_at` | Already typed in `features/auth`; `features/staff` imports it through the public export |
| Specialty | `doctors` `Specialty` | `id`, `name_en`, `name_ar`, `is_active` | |
| Doctor summary | `doctors` `DoctorSummary` | `id`, `name`, `title`, `is_active`, `specialties` | List shape. No email, role, or account id |
| Doctor | `doctors` `Doctor` | The above, plus `registration_number`, `created_at`, `updated_at` | `id` is **not** the account's id |
| Schedule | `scheduling` `Schedule` | `doctor_id`, `appointment_minutes` (nullable), `days[7]`, `updated_at` | Always 7 days, Sunday first |
| Slot | `scheduling` `Slot` | `date`, `start`, `end` | Computed by the API |
| Time off | `scheduling` `TimeOff` | `id`, `doctor_id`, `start_date`, `end_date`, `start_time`, `end_time`, `reason`, `created_at` | Null times mean whole days |
| Doctor fee | `payments` `DoctorFee` | `doctor`, `amount` (nullable), `set_at`, `set_by` | Null `amount` means not set |

## State

**Staff member**: `active` ⇄ `deactivated`. Both directions are idempotent. Deactivating ends all sessions, and reactivating doesn't restore them.

**Specialty**: `active` ⇄ `deactivated`. Never deleted.

**Doctor status**: derived by the API. Active only while the account is active and has the doctor role. No direct way to change it.

**Fee**: `not set` → `set` → `set`. Can't return to not set.

**Schedule**: `none` (`appointment_minutes: null`) ⇄ `set`. Replaced whole. May be `set` with no periods, after saving an empty week.

## Readiness

`features/doctors/readiness.ts`. A pure function, and nothing is stored.

**Input**, where each value is `unknown` if its read failed:

| Input | From |
|---|---|
| `active: boolean` | `doctor.is_active` |
| `hasPeriods: boolean` | Any of `schedule.days[].periods` isn't empty |
| `slotCount: number` | Length of the slots in the coming 31 days |
| `hasFee: boolean` | `fee.amount !== null` |

**Output**:

| Value | Rule |
|---|---|
| Four items | `complete`, `incomplete`, or `unknown`, each with a translated label and, where relevant, a link to its step |
| `bookable` | `slotCount > 0`. `unknown` if slots failed |
| `setupComplete` | `bookable` and `hasFee`. `unknown` if either is unknown and neither is false |
| `chargeWarning` | `bookable` and `hasFee === false` |

A claim is withheld only when it depends on an unknown value (FR-002): slots loaded and the fee failed gives `bookable` true and `setupComplete` unknown. `active` and `hasPeriods` are shown, but only slots decide bookability, since slots already reflect both.

## Form shapes

All are React Hook Form with Zod. Rules listed are quick feedback only, and the API's answer wins.

### Staff create

`name`, `email`, `role`, `password`, `password_confirmation`. Required; password 12–72 characters; confirmation matches. Sent as they are. Passwords are cleared after use.

### Staff edit

`name`, `email`, `role`. Only changed fields are sent. No changes means no request.

### Set password

`password`, `password_confirmation`. Same rules. Not available on one's own account.

### Specialty

`name_en`, `name_ar`. Required, at most 100. On rename, only changed names are sent.

### Doctor create

`user_id` (fixed, from the address), `title` (required, at most 100), `registration_number` (optional), `specialty_ids` (at least one). An empty registration number is left out.

### Doctor edit

`title`, `registration_number`, `specialty_ids`. Only changed fields are sent. A cleared registration number is sent as `null`. `specialty_ids`, when sent, is the whole set.

### Schedule

```text
appointment_minutes   5–240, multiple of 5
periods[]             { day, start, end }, in on-screen order, Sunday to Saturday
```

Rows are rendered grouped by `day`. Quick feedback covers the time format and at most 4 rows per day. The API checks everything else. Loaded from the API's `days`, flattened in order.

### Time off

`start_date`, `end_date`, `kind` (`whole` or `part`), `start_time`, `end_time`, `reason`. `kind` is form state only: `part` sends both times with `end_date` set to `start_date`, and `whole` sends neither. Blank `reason` is left out.

### Fee

`amount`, a string. Digits converted, format and range checked as in research R8. Sent as a string.

## Address parameters

| Page | Parameters | Sent to the API | Patient data? |
|---|---|---|---|
| `/staff` | `role`, `is_active`, `page` | As they are | No |
| `/doctors` | `name`, `specialty_id`, `is_active`, `page` | As they are | No, doctor names only |
| `/doctors/new` | `account`, `page` | `account` reads one account; `page` goes to the list | No |
| `/doctors/[id]` | `from`, `to` | Time-off range | No |
| `/fees` | `page` | As it is | No |
