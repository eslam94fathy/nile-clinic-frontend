# Quickstart: Medical Encounters

How to prove this phase works. Details are in [contracts/api-usage.md](contracts/api-usage.md) and [contracts/screens.md](contracts/screens.md).

## Prerequisites

- The backend running at commit `dff2dca`. Check its port with `docker ps`; `BACKEND_API_URL` in `.env.local` holds it.
- Doctors with profiles, created by the live suite's setup. All data is synthetic.

## Commands

```powershell
pnpm check          # Every quality check, including unit tests and the fake backend's e2e suite
pnpm test:e2e:live  # Against the running API
```

## The first measurement

Before anything is built on it ([R2](research.md)), on a production build, with something unsaved:

| Step | Expected |
|---|---|
| Press back | The warning appears |
| Stay | Same address, every character kept |
| Press back, and leave | The previous page |
| Back and forward afterwards | Work normally |

If this fails, follow R2's fallback, and tell the owner before going further.

## Automated: fake backend (`e2e/encounters.spec.ts`)

- Every state in [contracts/screens.md](contracts/screens.md), in both languages.
- Each role on each route, with a count showing no audited read for a refused role.
- Errors on the right field, including a line after an empty one.
- `401` on save, finalize, and addendum keeps the text, then signs in only when asked.
- `500` and no answer keep the text, and nothing is re-sent.
- Each way of leaving, with **Stay** and **Leave**.
- Marked-up text shows as text. Long unbroken text wraps. Pasted text over a limit isn't cut.
- Field attributes from [R9](research.md).

## Automated: running API (`e2e/live/encounters.spec.ts`)

Audit counts are read through the API, as an administrator, and each row checks the entries exactly.

| Journey | Expected entries |
|---|---|
| Start from "My queue" | `encounter.started`, no opening |
| Save with a change | `encounter.draft_saved`, no opening |
| Save with nothing changed | Nothing sent, and nothing written |
| Identical `PUT`, sent directly | No entry, confirming the source |
| Finalize with unsaved changes | `encounter.draft_saved`, `encounter.finalized`, no opening |
| Add an addendum | `encounter.addendum_added`, no opening |
| Open from a link | One `encounter.opened` |
| Hover, focus, reconnect, away and back, a refresh elsewhere, back | No further opening |
| The same link again | One more |
| Ctrl+click | One more, in that tab |
| Reload, or switch language | One more each |
| Polling "My queue" over four real intervals | No opening and no history entry |
| Open a history | One `encounter.history_viewed` |
| Each further page | One more each |
| Panel: open, choose a record, close, reopen | One each, with the draft untouched |
| Going to another doctor's record after the patient left | Not found, and one refused entry |
| Showing rows where no history is offered | No refused entry |

Access, each checked for its real status:

| Check | Expected |
|---|---|
| Administrator or receptionist on all seven operations | `403` |
| Another doctor's draft | `404`, identical to an unknown id |
| Another doctor's finalized record, patient on this doctor's list | `200`, read only |
| The same, patient marked as left | `404` |
| Changing another doctor's readable record | `403` |
| A history with no access, and no finalized records of this doctor's | `404` |

Also confirmed: all content saved at the largest sizes the API allows; Arabic text and line breaks returned as written; whether surrounding spaces are trimmed; two tabs, where the last save wins and finalizing locks it, with the notice appearing.

### Planted-text search

A distinct synthetic marker in every clinical field, line, and addendum. After every journey, none may be found in:

- any address visited, or any page title;
- `localStorage`, `sessionStorage`, IndexedDB, or Cache Storage;
- the application server's output;
- any audit entry;
- the HTML the server sends for a clinical page;
- the page reached by going back after sign-out.

## Accessibility

`e2e/accessibility.spec.ts` covers `/my/visits`, a draft with errors and with the panel open, a finalized record with addenda, a history, and each dialog, in both languages, directions, and themes.

## By hand

Check once in `en` and once in `ar`, in both themes:

1. **Keyboard**: start, write, add and remove a line, save, open the panel and a record, close it, finalize, and add an addendum, with no mouse. Check where focus lands after each.
2. **Screen reader**: confirm the unsaved notice, errors on lines, and results are spoken, and that no clinical text is announced by a confirmation.
3. **Shared computer**: sign out with a record on screen, press back, and confirm nothing appears.
4. **Mixed text**: write Arabic and English in one field, and read it in both interface languages.
5. **Timing**: from a patient being with the doctor to writing, in one action (SC-001).
6. **Crash**: close the browser's process with unsaved text, reopen, and confirm nothing was restored.
7. **Real back button**: with unsaved text, press the browser's own back button, and the mouse's or keyboard's, and confirm the warning appears. Playwright's back isn't the same thing ([R2](research.md)).

## Permissions

| Screen or action | A | R | D |
|---|---|---|---|
| `/my/visits`, `/my/encounters/[id]`, `/my/patients/[id]/history` | Not allowed, with no read | Not allowed, with no read | ✓ |
| Any change to a record | `403` if forced | `403` if forced | Author only |
| Any existing screen, showing a record's status | Never | Never | "My queue" and "My visits" only |

`e2e/encounters.spec.ts` compares each cell on the fake backend, and the live suite repeats the forced `403`s.

## Before acceptance

`privacy-review.md` exists, every area in FR-045 has observed evidence, and the owner has accepted or rejected each open risk (SC-011).
