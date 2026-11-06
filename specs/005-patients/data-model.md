# Data Model: Patients

The API owns all data, and nothing here is stored by the application. Field rules come from `contracts/patients.openapi.yaml` and `PatientRules`. Types derive from `lib/api/generated/patients.ts`, and response schemas use `satisfies z.ZodType<Generated>`.

## API entities

| Entity | Fields | Notes |
|---|---|---|
| `PatientSummary` | `id`, `full_name`, `sex`, `date_of_birth`, `phone` | List and search. Not audited |
| `Patient` | Summary, plus `national_id`, `address`, `emergency_contact`, `created_at`, `updated_at` | Each read writes `patient.opened`. `POST` and `PATCH` return it |
| `EmergencyContact` | `name`, `relationship`, `phone` | All three or `null` |

## Form values

Every field is a string while on screen, and optional parts are `""` when empty.

| Field | Required | Quick feedback (the API's answer wins) |
|---|---|---|
| `full_name` | Yes | Not blank after trimming; at most 255 |
| `date_of_birth` | Yes | Between 130 years ago and the clinic's today, by string comparison |
| `sex` | Yes | No default; `male` or `female` |
| `phone` | Yes | After removing spaces, dashes, and parentheses: `^\+?[0-9]{8,15}$` |
| `national_id` | No | `^[23][0-9]{13}$` |
| `address` | No | At most 500 |
| `emergency_contact.name` | With any part | At most 255 |
| `emergency_contact.relationship` | With any part | At most 50 |
| `emergency_contact.phone` | With any part | Same as `phone` |

Digits are converted before checks, on phone, national ID, and emergency phone (R9).

## Conversions (`form-values.ts`, unit tested)

| Function | Rule |
|---|---|
| Record to form | `null` becomes `""`, and a `null` contact becomes three `""` |
| Form to register body | Blank optional fields are left out. A contact goes only when any part is filled in |
| Form to changes | Compares normalised values with the record, and returns only what differs. Blank optional with a value becomes `null`. A contact goes whole when any part differs, and as `null` when all three are blank and one was recorded. Returns nothing at all when nothing differs |

"Normalised" means trimmed, with digits converted, and with phone separators removed. The API normalises the same way, so typing `010 0000 0001` over `01000000001` isn't a change. A `PATCH` of no change would otherwise write a false opening (R6).

## Search terms

| Term | API filter | Match | Held in |
|---|---|---|---|
| Name | `name` | Part, by the API's Arabic-aware rules | Component state only |
| Phone | `phone` | Exact, after normalising | Component state only |
| Patient number | `id` | Exact | Component state only |
| National ID | `national_id` | Exact | Component state only |

Blank terms aren't sent. All blank means no request at all, because no filter lists everyone.

## In-memory opening state (`opening.ts`)

Module-level, in the browser, never persisted, and gone at a full page load, which sign-out always is.

| Value | Set by | Used by | Lifetime |
|---|---|---|---|
| Handed-over record | The register form, on `201` | The reader, instead of reading | Until the reader takes it |
| Asked-for marks (patient ids) | A plain click on `PatientLink` | The reader's effect, to read again | Until that read |
| Change counter | Register, and a successful save | `PatientSearch`, to repeat its last search on being shown | Page lifetime |

## Reader states

```text
             mount, no handed record           read fails              person chooses to try again
  (start) ─────────────────────────► loading ───────────► failed ─────────────────────────► loading
     │                                  │  ▲                  (403 forbidden, 404 not found, else error)
     │ handed record                    │  │ asked-for mark, or "Reload details"
     ▼                                  ▼  │
  showing ◄──────────────────────── showing ──"Edit"──► editing ──save (200) or cancel──► showing
```

- Showing again from hidden, with no mark: no change, and no read.
- `401` at any point: `browserApi` ends the session and never settles.
- "Reload details" isn't available while editing or loading.
- During a repeat read, the held record stays on screen with a progress indication. If that read fails, the error appears above the held record, which is labelled as possibly out of date.

## Register states

```text
editing ──submit──► checking ──no matches──► saving ──201──► hand over, then move to /patients/{id}
                       │                       ▲
                       ├──matches──► warned ───┤ "Register anyway"
                       └──failed───► warned ───┘ (also "Try again")
```

- Format-invalid phone: checking is skipped, and the normal quick feedback shows.
- Changing the phone while warned returns to editing, and the panel disappears.
- On `201`: `reset()`, so that a held form is empty on returning.
