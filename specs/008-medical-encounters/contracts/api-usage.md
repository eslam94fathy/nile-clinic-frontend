# API Usage: Medical Encounters

Verified against `specs/008-medical-encounters/contracts/encounters.openapi.yaml` and source in the backend, at commit `dff2dca`. To be confirmed on the running API by `e2e/live/encounters.spec.ts`, as implementation proceeds.

## Operations

All doctor only. Administrators and receptionists get `403` before any lookup.

| Operation | Read from | Audit | Success | Failures handled |
|---|---|---|---|---|
| `GET /doctors/me/visits?from&to&record_status&page&per_page` | Server for "My visits"; browser, every 15 s, for "My queue" | None | `200`, page | `401`, `403`, `404` (no profile), `422` |
| `POST /doctors/me/visits/{visit}/encounter` | Browser | `encounter.started` | `201`, record | `401`, `403`, `404`, `422` under `visit` |
| `GET /doctors/me/encounters/{id}` | Browser, **audited read** | `encounter.opened`; a refusal on a record that exists writes a refused entry | `200`, record | `401`, `403`, `404` |
| `PUT /doctors/me/encounters/{id}` | Browser | `encounter.draft_saved`, if something changed | `200`, record | `401`, `403`, `404`, `422` |
| `POST /doctors/me/encounters/{id}/finalize` | Browser | `encounter.finalized` | `200`, record | `401`, `403`, `404`, `422` |
| `POST /doctors/me/encounters/{id}/addenda` | Browser | `encounter.addendum_added` | `201`, addendum only | `401`, `403`, `404`, `422` |
| `GET /doctors/me/patients/{id}/encounters?page&per_page` | Browser, **audited read** | `encounter.history_viewed`, per page; a refusal on a patient with finalized records writes a refused entry | `200`, page | `401`, `403`, `404`, `422` |

Audit entries hold the names of changed fields and the status, never clinical text (`AuditChanges`' allow-list has only `status` for encounters).

## Other features' operations used here

| Operation | Read from | Used for | Audit |
|---|---|---|---|
| `GET /doctors/me` | Server | The gate's no-profile state, and the doctor's own number, deciding what's offered | None |
| `GET /doctors/me/queue` | Browser | Whether a patient is on today's list, once with "My visits" or a draft ([R8](../research.md)). "My queue" already reads it | None |

`GET /patients/{id}` is **never** used here. A doctor gets `403` on it, and the summary comes with each record and visit.

## Bodies

```json
PUT /doctors/me/encounters/{id}
{
  "chief_complaint": "Synthetic text",
  "examination_findings": null,
  "diagnosis": null,
  "treatment_plan": null,
  "prescriptions": [
    { "medication": "Synthetic", "dosage": null, "frequency": null, "duration": null, "instructions": null }
  ]
}
```

Every key is required: a missing one is `422`, so that a client can't erase what it forgot. Use `null` or `[]` for what's empty.

```json
POST /doctors/me/encounters/{id}/addenda
{ "text": "Synthetic text" }
```

Starting and finalizing have no body.

## Error keys

| Source | Keys | Where |
|---|---|---|
| Start | `visit` | On the row or page. The list is then read again |
| Save | Each content field, `prescriptions.<n>.<field>`, `prescriptions` | On its field, or at form level |
| Save, finalized meanwhile | `encounter` | Form level, with an explicit way to open the record |
| Finalize | `chief_complaint`, `diagnosis`, `prescriptions.<n>.dosage`, `.frequency`, `.duration` | On its field |
| Addendum | `text`, `encounter` | On the field, or at form level |
| List | `from`, `to`, `record_status`, `per_page`, `page` | On the filter, or at page level |

`visit_not_started`, `already_started`, `not_editable`, `required_to_finalize`, and `not_finalized` are translation keys and **aren't sent**, so they're never compared. `409` doesn't occur on these routes.

## `401`, `403`, and `404`

| Status | On a read | On a change |
|---|---|---|
| `401` | Leaves for sign-in, as everywhere | Answered to the page, which keeps the text and says nothing was saved. Leaves when the person chooses ([R5](../research.md)) |
| `403` | The not-allowed state, and the page's gate decides again | The message, nothing changes, and the text stays. It can mean another doctor's record |
| `404` | One neutral not-found state, and the text is removed | The same state. **Text being written is kept on screen** with the message, because the doctor's only copy is on screen |

## Limits

| Limit | Value | Where it's met |
|---|---|---|
| Clinical field | 10,000 characters | The hint, and the API's `422` |
| Prescription field | 500 characters | The hint, and the API's `422` |
| Lines | 20 | "Add line" stops, and the API's `422` |
| Addendum | 10,000 characters | The hint, and the API's `422` |
| Visits range | 92 days including both ends | The API's `422` under `to` |
| `per_page` | 100 | Default 15 on pages; 100 on "My queue"'s join |

## Order

Visits: date, then queue order, oldest first. History: newest first. Addenda: oldest first. None is re-sorted here.

## What can't be done

- **No version check on saves.** The last `PUT` wins, and it can't be detected at the time. New gap G9.
- **No reading one visit.** A visit's state is only available through the list, by range.
- **No way to tell why a start was refused,** other than the message, so it's never parsed.
- **No patient directory for doctors,** so there's no patient filter in "My visits", though the API has one.
