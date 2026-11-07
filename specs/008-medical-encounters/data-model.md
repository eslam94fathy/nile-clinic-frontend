# Data Model: Medical Encounters

Types come from the generated `lib/api/generated/encounters.ts`. This describes how the frontend uses them. Nothing is stored by the frontend.

## From the API

| Entity | Fields | Clinical? |
|---|---|---|
| `Visit` | `id`, `date`, `walk_in`, `arrived_at`, `called_at`, `finished_at`, `record_status`, `encounter_id`, `patient` | No |
| `Encounter` | `id`, `visit_id`, `status`, `date`, `doctor` (`id`, `name`, `title`), `patient`, `chief_complaint`, `examination_findings`, `diagnosis`, `treatment_plan`, `prescriptions`, `addenda`, `started_at`, `last_saved_at`, `finalized_at` | **Yes** |
| `PrescriptionLine` | `medication`, `dosage`, `frequency`, `duration`, `instructions` | **Yes** |
| `Addendum` | `id`, `text`, `created_at` | **Yes** |
| `EncounterHistoryItem` | `id`, `date`, `doctor` (`id`, `name`, `specialties`) | No |
| `PatientSummary` | `id`, `full_name`, `sex`, `date_of_birth` | No, but personal |

`id` on a visit is the queue entry's id, so it joins directly to a row of `GET /doctors/me/queue`. `visit_id` on a record is the same value.

Value kinds: `date` and `date_of_birth` are clinic dates, shown as sent. Every `*_at` is an instant, shown in the clinic's time zone. Clinical text is shown exactly as written.

## States of a record

```text
          start                    finalize
(none) ─────────► draft ──────────────────► finalized ──┐
                   ▲  │                         ▲       │ add addendum
                   └──┘                         └───────┘
                   save
```

| State | Author sees | Another doctor sees |
|---|---|---|
| `none` | "Start record" | Nothing |
| `draft` | The form, finalize, and any history as [R8](research.md) allows | Not found |
| `finalized` | Read only, adding an addendum, and history | Read only, if on their list today. Otherwise not found |

Nothing goes backwards, and nothing is ever deleted. Whether a change is allowed is always the API's decision.

## Form values

Held only in the open page's memory.

| Form field | From the record | To the request |
|---|---|---|
| `chief_complaint`, `examination_findings`, `diagnosis`, `treatment_plan` | `null` becomes empty text | Trimmed; empty becomes `null` |
| `prescriptions[n]` fields | `null` becomes empty text | Trimmed; empty becomes `null` |
| A line with every field empty | Doesn't arise | Left out |

**Validation in the form is shape only.** No required field, because a partly written draft is valid, and a line with no medication is the API's to refuse. No length limit, as [R3](research.md) explains.

**Changed** means: the request made from the form differs from the request made from the last saved record, comparing every field and every line in order.

**Lines**: at most 20 can be added, as a convenience, and the API decides. A record may have no lines at all. Removing a line that has text in it doesn't ask, since nothing is permanent until saved, and the unsaved notice shows.

## Error keys to fields

| Key | Goes to |
|---|---|
| `chief_complaint`, `examination_findings`, `diagnosis`, `treatment_plan` | That field |
| `prescriptions.<n>.<field>` | That field, on the screen line that request line `<n>` came from |
| `prescriptions`, `encounter`, `visit`, `text` | Form level, except `text`, which goes on the addendum's field |
| Anything else | Form level, never dropped |

## "My visits" filters

Held in the address, so they survive a reload and going back.

| Parameter | Valid | Default or if invalid |
|---|---|---|
| `from`, `to` | A real date | The last 30 days, up to the clinic's today. An invalid value is ignored |
| `record_status` | `none`, `draft`, `finalized` | Every status |
| `page` | A positive whole number | 1 |

A range over 92 days is sent, and the API's `422` under `to` appears on that field. Clinical text can't be a filter.

## Marks, all in memory

The shared module holds these per feature ([R1](research.md)). A full page load clears them.

| Mark | Set by | Taken by | Lifetime |
|---|---|---|---|
| Asked for a record | A plain click on `RecordLink` | The record's reader | 15 seconds |
| Asked for a history | A plain click on `HistoryLink` | The history's reader | 15 seconds |
| Handed-over record | Starting a record | The record's reader | 15 seconds |

## Would-be-lost store

`lib/unsaved-changes.ts` holds one thing: whether a visible form on this page has something to lose. A form sets it while changed, and removes it on saving, discarding, or being hidden. It never holds the text.
