# Contract: Screens

Administrators and receptionists have identical access to all three pages. A doctor sees the "not allowed" state from `ScreenGate`, with no content sent and no patient request made. All three are in `<Suspense>` with `ScreenGate path="patients"`, and pass messages through `ScopedMessages`.

The browser's tab title is the fixed page name on all three, never a patient's details.

## `/patients`: find a patient

| State | Shows |
|---|---|
| Before any search | Four labelled fields with match hints, "Register a patient", and a prompt. No request made |
| All fields blank, submitted | Form-level "enter at least one term". No request made |
| Loading | Fields stay, with `LoadingState` under them. A newer search overrides an older answer |
| Error | `ApiFailureState`, with `onRetry` repeating the search. Terms stay |
| `422` | The API's message on its field |
| Empty | "No patients match", terms stay, and a link to register |
| Success | `DataTable` of number, name, sex, date of birth, and phone, using `PatientLink`, with button paging |

"Reset" clears the terms and results, and returns to the first state.

## `/patients/new`: register

| State | Shows |
|---|---|
| Editing | Form with a required details section, then optional ones. A note says to search first. Autofill off |
| Checking, saving | Button shows progress; double submission is blocked |
| Warned: matches | Panel with number, name, sex, date of birth, and phone for each, the total, each a `PatientLink`, and "Register anyway". The wording notes that families often share a phone |
| Warned: failed | Panel saying the check couldn't run, with "Try again" and "Register anyway" |
| Refused | The API's messages on their fields. All typed values kept |
| Success | Moves to `/patients/{id}`, showing the returned record, with a confirmation naming the patient number |

## `/patients/[id]`: one patient

Invalid number in the address: the neutral not-found state, with no request made.

| State | Shows |
|---|---|
| Loading | `LoadingState`, on the first read only |
| Failed, nothing held | `403`: forbidden state. `404`: neutral not found. Otherwise an error with "Try again", which asks for the read |
| Showing | Header with the name as written and the patient number. Details as a list, with "not recorded" for absent values. Registered and last changed in the clinic's zone. "Edit". "Reload details" with a hint saying this records another opening. A link back to the search |
| Reloading | Record stays; "Reload details" shows progress |
| Reload failed | Error above the held record, which is labelled as possibly out of date |
| Editing | Form filled from the record, with "Save" and "Cancel". "Reload details" isn't available |
| Nothing changed, on save | Form-level "nothing to save". No request made |
| Refused | The API's messages on their fields. Typed values kept |
| Saved | Returns to showing, using the returned record, with a confirmation |

## `PatientLink`

The only way to link to a record, and exported from `features/patients/public.ts` for later phases. `prefetch={false}`. A plain click marks the record as asked for (research R2).

## Shared component changes

See research R5: `FilterBar` (`errors`, and autofill off on private filters), `DataTable` (`onPage`), `ApiFailureState` (`onRetry`, and a client export).
