# Research: Patients

Evidence comes from the backend at commit `dff2dca`, and from a spike on 2026-11-06. Anything marked **observed** was run on a production build against the Docker API, counting real `patient.opened` entries through `GET /audit-entries`. The spike's temporary pages were removed afterwards.

## R1. How a patient's record is read

**Decision**: The record is read in the browser, by a Client Component that holds it in state, through the same-origin route. It isn't read in a Server Component. This is an exception to [ADR 0011](../../docs/decisions/0011-server-reads-and-refresh.md), to be recorded as ADR 0012, and it applies only to audited reads.

**Rationale**: FR-014 says that a change on another page, followed by going back, must not read the record. A server read can't meet that, and a client reader does.

| Step (one patient, in order) | Server read: entries | Client reader: entries |
|---|---|---|
| List shown, link hovered | 0 | 0 |
| Link to another patient with default prefetch, hovered | 0 for that patient | 0 for that patient |
| Open by link | 1 | 1 |
| Focus, visibility, and online events | 1 | 1 |
| Leave by link, then back, with no refresh anywhere | 1 | 1 |
| `router.refresh()` on another page, record hidden | no change | no change |
| **Back, after that refresh** | **+1** | **no change** |
| `router.refresh()` on the record's own page | **+1** | no change |
| Back, after a full page load elsewhere | +1 | +1 |
| Full reload on the record | +1 | +1 |

**Observed**: every form in Phase 4 ends in `router.refresh()`, so with a server read, saving anything and pressing back would write a false opening. A full load is a person leaving the application and returning, and it reads in both designs, which is true.

**Alternatives**:

- Server read, with no `router.refresh()` in patient flows. Doesn't help, since other features' forms refresh too.
- Server read, with the refresh removed everywhere. Reverses ADR 0011's tested design, for one feature's sake.
- TanStack Query for this one read. It adds a dependency that Phase 7 will bring anyway, yet what's needed is one guarded read and no cache, so it would add nothing here. Principle IX.

**Limit**: the reader needs JavaScript. The page's frame and the gate work without it, but the record doesn't appear. Search and the forms need JavaScript in any case.

## R2. Reading again when a person asks

**Decision**: `PatientLink` is the only way to link to a record. A plain click marks that record as asked for, in memory. The reader's effect runs on mounting and again each time a held page is shown, and it reads when it has never read, or when the mark is there. The mark is used up by reading. Clicks that open another tab or window make no mark, as that tab reads for itself.

**Rationale**: With only R1, a second click on the same patient showed the held copy and wrote nothing (**observed**). That breaks SC-003 in the opposite direction, under-recording what a person asked for and possibly showing old data. Going back must stay silent, so the application has to tell a click from the back button, and only the click can say so.

**Observed**, all as expected:

| Step | Entries |
|---|---|
| First click | 1 |
| Away, then back | 1 |
| Second click | 2 |
| Refresh on another page | 2 |
| Back after that refresh | 2 |
| Ctrl+click: the new tab reads | 3 |
| Back in the first tab, where no mark was left | 3 |

**ADR 0005 and ADR 0006**: both say an audited read mustn't start from a *bare* `useEffect`. This effect isn't bare, as it's guarded by a ref and the mark. The rule's concern, effects re-running when a page is shown again, is exactly what the measurements above test. A permanent live test keeps them. **Not measured**: development mode. React's Strict Mode should keep the ref across its repeat run, so the guard should also answer ADR 0005's development concern, but that's expected rather than observed. It's to be checked once by hand during implementation, and the result recorded here. The live test covers production builds only.

## R3. Showing the record after registering

**Decision**: After `POST /patients`, the form hands the returned record to the same in-memory module and moves to `/patients/{id}` with `router.replace`. The reader takes the handed record instead of reading.

**Observed**: moved with a handed record, 0 entries. Away, then back, 0. Full reload, 1, read from the API.

**Rationale**: FR-011. `replace`, because a submitted form isn't somewhere to go back to, and the address then really is the patient's, so a reload behaves correctly. Keeping `/patients/new` in the address, and swapping the content, would make a reload offer an empty form for a patient who has just been saved.

**Limit**: the record stays in that module only until the reader takes it, moments later. It's memory only, and sign-out's full page load clears it.

## R4. Search runs in the browser too

**Decision**: `PatientSearch` holds its terms, page, and results in component state, and calls `GET /patients` through the same-origin route when a search is submitted. Nothing reads on the server.

**Rationale**: Constitution II forbids patient details in addresses chosen by the frontend, and allows them only in the API's own query parameters. A Server Component can only learn the terms from the address. The same-origin route already logs no query strings and sets `no-store`, and `fetch` leaves nothing in browser history.

**Consequence**: a reload clears the search, as the spec accepts. Going back restores it while the page is held, because hidden pages keep their state (ADR 0011).

**Results after a change**: an in-memory change counter goes up on each register or save. `PatientSearch`'s effect, which runs each time the page is shown, repeats the last search if the counter moved. List reads aren't audited, so this is safe (FR-020). `router.refresh()` wouldn't help, as nothing here is on the server.

## R5. What existing shared components need

Each has a real consumer here, and each change is small.

| Component | Change | Why |
|---|---|---|
| `FilterBar` | Takes `errors`, shown on each field. Private filters (`inAddress: false`) get `autoComplete="off"` | US1.5 needs the API's message on its field. FR-029. Turning autofill off also stops browsers restoring the terms after a full back navigation |
| `DataTable` | Pagination takes `onPage` as an alternative to `hrefForPage`, rendering buttons rather than links | Search's page number can't be an address without keeping the terms alongside it |
| `ApiFailureState` | Takes an optional `onRetry`, used instead of the full reload. It's exported from `features/auth/public.ts` too | A record's error mustn't cost the person a full reload, and a search's error mustn't clear their terms. Neither reader can retry on its own |

## R6. Backend behaviour found in source

From `PatientService`, `PatientRules`, `UpdatePatientRequest`, and `ListPatientsRequest`. To be added to `docs/backend-integration.md`.

- **A `PATCH` that changes nothing writes `patient.opened`** (`PatientService::update`), so that sending one known field can't read the rest without a trace. So FR-018's "send nothing when nothing changed" also protects the audit trail, and comparison must happen after trimming and phone normalising, or a no-op could still be sent.
- **An empty `PATCH` is `422`, under the key `fields`.** The form doesn't send one.
- **Search validates its filters.** A malformed `phone` or `national_id` is `422` on that key, not an empty result. `phone` is normalised on the API before matching, and matching is exact.
- **Sending no filters lists everyone**, so FR-003's rule that an empty search sends nothing has to be enforced here.
- **Emergency contact:** nested keys `emergency_contact.name`, `.relationship`, and `.phone`, each required when the object is sent. `null` clears all three.
- **`national_id` uniqueness race:** two simultaneous writes give the same `422` on `national_id`, so nothing extra is needed.
- **`{patient}` is numeric-only on the route,** and `readPositiveId` already screens addresses, so a non-numeric address never reaches the API.

## R7. Editing in place

**Decision**: "Edit" swaps the details for the form on the same page, from the record in state. A separate address would need the record again, and writing a second opening only to change a phone number is what the spec rules out.

**If a new read arrives during editing**, from a link click on a held page, the record underneath is replaced, and what was typed stays. Comparison for "what changed" uses the latest record. The form mounts only while editing, so saving or cancelling leaves nothing behind.

## R8. Duplicate check

**Decision**: On submitting the register form, a phone that passes the format check is searched with `GET /patients?phone=…&per_page=10`, before any `POST`. Matches appear in a panel above the buttons, with `PatientLink`s, the total, and "Register anyway". The checked phone is kept, so that changing the phone re-checks, and "Register anyway" applies only to that exact phone.

**Rationale**: List reads aren't audited, and show only the five list fields. The panel is a warning, because the backend's own spec says phones are shared by families. `per_page=10` is plenty for one phone, and the total says if there are more.

**If the check fails**, the panel says it couldn't run, and offers "Try again" and "Register anyway". `403` and `401` take their usual routes.

## R9. Entering values

- **Date of birth**: `type="date"`, as time off already uses, so it yields `YYYY-MM-DD`. Quick feedback compares strings against bounds worked out from the clinic's today, which the page passes as a prop, so no `Date` conversion can shift the day.
- **Digits**: `toWesternDigits` from `lib/format/digits` on phone, national ID, and patient number, before checks and sending (FR-031). Native date inputs yield Western digits already.
- **Phone display**: `LtrText`, as sent. **Names and addresses**: `UserText`, in their own direction. **Sex**: translated. **Absent values**: "not recorded" text, rather than `NoValue`'s dash, as the spec requires words.
