# Research: Queue

Findings come from the backend's source and contracts at the analyzed commit `dff2dca`, this repository's code, and the Next.js documentation in `node_modules`. Nothing here has run against the live API yet. The live suite confirms each of these during implementation ([quickstart.md](quickstart.md)), and `docs/backend-integration.md` records only what's observed.

**TanStack Query's behaviour below was written from knowledge of its version 5, before it was installed.** Each point has since run in this project, and R2 and R3 record where measuring changed anything.

## R1. Reading the queue: in the browser, through TanStack Query

**Decision**: Queue lists read in Client Components through a hook over `useQuery`, calling `browserApi`. The page's server part only gates, and reads what the filters need. There's no server read of the list.

**Rationale**: `QueueController` and `OwnQueueController` write no audit entry on reads, only their services' actions do, so polling is safe. A server read then a client takeover would mean hydrating, which under Cache Components needs a hand-built state because `dehydrate()` reads the clock (Next.js guide). It would also add a second path, for a loading state lasting a moment. Patient screens already read in the browser, so this adds no new kind of first paint.

**Provider**: Only on the queue's pages, through `LiveQueryProvider`, rather than in the app's layout, because nothing else reads this way and other pages shouldn't carry the library. It's kept in `useState`, so each page has one client. A full page load clears it, which is already what sign-out and a `401` do (ADR 0010).

**Alternatives**: `router.refresh()` on a timer: re-renders the whole server page and its gate, with `GET /auth/me` each time, and has no notion of a failed refresh keeping the last list. About 60 lines of own polling: possible, and this project rejected `next-themes` on that reasoning. But request ordering, in-flight cancelling after a change, retry, and last-read time are what ADRs 0005 and 0011 installed the library for, and the owner approved it in the stack. Recorded in ADR 0013.

## R2. Stopping on hidden tabs and hidden pages

**What's known**: `refetchIntervalInBackground: false` skips the timer's read while the document is hidden. Next.js keeps visited pages mounted under React's `<Activity>`, and hiding runs effect cleanups (Next.js guide, and ADR 0011 measured it). `useQuery` subscribes in an effect-like way, so a hidden page should have no observer, and so no timer.

**What isn't known**: that this holds in this version of each. An unmeasured assumption here would keep sessions alive and read patient details nobody is viewing, so it's measured first.

**Measurement**: With the fake backend, count `GET /queue` while visible, after moving to another page in the application, and after returning. Use a real interval once, and keep it as a permanent test in `e2e/queue.spec.ts`.

**If it fails**: a `useLayoutEffect` in the hook sets a flag on hiding and clears it on showing, and the flag drives `enabled`. Effects are what the documentation guarantees to run on hiding, so this can't fail the same way. ADR 0013 would record it.

**Measured** (2026-11-07, production build, fake backend): it holds. Left for another page with the list confirmed still in the DOM, two real intervals gave 0 reads, with at least one read on the previous interval and one on returning. The tab hidden for one real interval gave 0 reads, with one on showing it. 2 minutes of test clock, and a doctor's list, gave the same. The fallback wasn't needed. `e2e/queue.spec.ts` keeps all of these.

**Returning**: A list shown again resubscribes, and with `staleTime: 0` it reads at once. A tab shown again reads through `refetchOnWindowFocus`, which in version 5 listens for `visibilitychange`. The timer isn't restarted by this, so the next read can come sooner than 15 seconds later, which is harmless. The spec was reworded to allow it.

## R3. What a refresh's failure does

| Answer | Screen | Reading |
|---|---|---|
| `0`, `5xx` on a first read | Error state with a way to try again | Continues |
| `0`, `5xx` on a refresh | Last list stays, with the notice and last-read time | Continues |
| `401` | `browserApi` already ends the session, and never settles | Page leaves |
| `403` | "Not allowed" state; patient details removed | Stops |
| `404`, a chosen doctor | Neutral not-found state, with a link to all doctors | Stops, for that doctor |
| `404`, own list | The page refreshes, and the gate shows "profile not set up" | Stops |

**How stopping works**: `enabled` takes a function of the query in version 5, and it sees the stored error, which stops the timer, focus, and returning to the page alike. That alone would leave the data in the cache, so the query function clears the data before it throws a `403` or `404`. This replaced the first plan, of removing the query and holding the error in the hook's own state, which needed an effect and gained nothing.

**`networkMode: "always"`**: By default, TanStack Query pauses when `navigator.onLine` is false, with no error, so the notice wouldn't appear on a computer that says it's offline. Failing visibly is the requirement (FR-017).

**Retry**: Once, for `0` and `5xx`, as ADR 0005's "live" kind allows retrying. `4xx` never. The next tick is the real retry. Actions never retry.

## R4. After an action

**Decision**: Actions use `browserApi` directly, with the project's in-flight guard, not `useMutation`. On any answer, the hook's `refresh()` invalidates the queue's queries, which cancels a read in flight, so an older answer can't overwrite a newer one (FR-014).

**Calling and finishing**: The API's answer also goes into the list on screen, through the pure `applyEntry`, so that the patient the API returned is shown as current even if the following read fails (US4). The confirmation also names them.

**Why not `useMutation`**: The project's mutation pattern is established (`useFormSubmit`, `ConfirmedAction`), and a second one adds nothing here.

**Check-in** is on a page that follows ADR 0011, so it uses `router.refresh()`. The Queue page, if held, reads again on being shown (R2).

## R5. Dialogs and a list that changes

**Problem**: A dialog inside a row disappears if a refresh changes the row's status or removes it. FR-015 forbids that, and it would be a confusing thing to happen to someone about to confirm.

**Decision**: One `EntryActionDialog` above the groups, holding a copy of the entry it was opened for, so its text can't change while someone reads it. Rows only say which entry and action they want. `ConfirmDialog`'s `trigger` becomes optional for this.

**Focus**: On closing, focus returns to the row's button if it still exists, found by a data attribute, and otherwise to the page's heading. `onCloseAutoFocus` already exists for this. The same applies to call next and finish, whose button can change.

**A refusal** keeps the dialog open with the API's message, as `ConfirmedAction` does, and the list is read again underneath. Unlike the appointment's page (Phase 6, R8), the dialog here isn't removed by a refresh, so there's no need to move the message to the page.

**Row focus during a refresh**: Rows are keyed by entry number, so React keeps the DOM and its focus when data changes. If the focused row goes, focus falls to `body`, so the list checks after an update, and moves focus to the heading only when focus was in a row that's gone (US3).

## R6. Filters and paging

**Address**: `/queue?doctor_id=3&status=waiting&page=2`, using `FilterBar` as Appointments does. A doctor or status that can't be valid is ignored by `readQueueFilters`, and the filter shows "all". A doctor who doesn't exist gets the API's `404`.

**Which read**:

| Filters | Read | Note |
|---|---|---|
| None, or status | `GET /queue?status&page&per_page=100` | Paged by the API, by doctor then queue order |
| Doctor | `GET /doctors/{id}/queue` | Complete, not paged |
| Doctor and status | `GET /doctors/{id}/queue`, filtered on screen by exact status | The API's `/doctors/{id}/queue` has no status filter. Complete, so this can't mislead, and it isn't a backend rule |

**`per_page=100`**, the maximum, so a day rarely needs paging, and a page holds a whole doctor more often. The backend measured it at under 20 ms with 5,000 entries (its `verification.md`).

**Page beyond the end**: The list can shrink. An empty page with `current_page > last_page` replaces the address with `last_page`, as patient search already falls back (US3).

**Grouping**: `groupByDoctor` groups adjacent rows by `doctor.id`, in the API's order, and never re-sorts. A doctor crossing a page break repeats their name on the next page.

## R7. What's offered

| Where | Rule | Source |
|---|---|---|
| Appointment | `check_in` if status is `scheduled` and date is the clinic's today, alongside what Phase 6 offers | `QueueService::checkIn` |
| Row | `mark_left` if `waiting`. `undo` if also `appointment` isn't null | `QueueService::leave`, `undo` |
| Own list | `finish` if any row is `with_doctor`. Otherwise `call_next` if any is `waiting`. Otherwise neither | `DoctorQueueService` |

All are pure functions, and only decide what's shown. A person may see "Call next" when everyone waiting is with another doctor. The API refuses, and that's an ordinary path, because the doctor's list can't show that fact.

`offeredActions` already takes `clinicNow`, whose date part is the clinic's today, so check-in needs no new input.

**Check-in has no entry id on the appointment's page.** `AppointmentResource` holds no link to the queue entry, so undoing from there would need another read to find it. Undo stays on the queue (FR-004).

## R8. Refusals

From `QueueService` and `DoctorQueueService`:

| Action | Answer | Key | Screen |
|---|---|---|---|
| Check in | `422` | `appointment` | Page level, and the page refreshes |
| Check in | `409` `already_checked_in` | `message` | Page level, and the page refreshes |
| Check in | `404` | | `router.refresh()`; the page shows not-found |
| Walk-in | `422` | `patient_id` | On the chosen patient, kept |
| Walk-in | `422` | `doctor_id` | On the chosen doctor, kept |
| Walk-in | `409` | `message` | Form level. The backend found this unreachable |
| Left, undo | `422` | `entry` | In the dialog; the list is read again |
| Left, undo | `404` | | In the dialog; the list is read again |
| Call next | `422` | `queue` | In the dialog; the list is read again |
| Call next | `409` `patient_with_another_doctor` | `message` | In the dialog; the list is read again |
| Finish | `422` | `queue` | In the dialog; the list is read again |
| Any | `403` | | Message, and the read that follows shows "not allowed" |
| Any | `0`, `≥ 502` | | "Can't tell whether it was saved", and the list or page is read again |
| Any | `500` | | General message. The action did not happen |

`not_checkable`, `not_changeable`, `already_in_queue`, `has_active_charge`, `visit_in_progress`, `nobody_waiting`, and `no_current_visit` are translation keys and **aren't sent**, so they're never compared.

## R9. Walk-in is its own page

**Decision**: `/queue/walk-in`, with `?patient_id=N` when carried, rather than a panel on the Queue page.

**Rationale**: It matches `/appointments/new?patient_id=N` from Phase 6, and the third link can be built the same way. Patient and doctor choosers are large, and on a panel they'd compete with a list that's refreshing underneath. On success it moves to the Queue page, which reads again on being shown.

**Spec change this caused**: US5 scenarios 4 and 6 and SC-006 assumed a panel. They now say the Queue page appears on success, leaving adds nothing, and a confirmation or filter is what's protected from refreshes.

## R10. Showing time

**Last read**: `dataUpdatedAt` is a browser clock reading of when the read finished. It's a moment, not a clinic value, so it goes through the existing `Instant` with the clinic's zone, passed from the page. The clock may be wrong by however much the computer is, which is harmless for "last read".

**`Instant`**'s format shows a date and a time to the minute. That suits a 15-second list, as seconds would change the screen constantly, so it's used as it is.

## R11. Assistive technology

The list has no live region. Toasts and `FormError` announce a person's own results, as elsewhere. The out-of-date notice appears once on failing, with `role="status"`, and isn't repeated on each failed read, so a broken connection doesn't speak every 15 seconds.

## R12. A live test of two computers

**Decision**: Two browser contexts in `e2e/live/queue.spec.ts`, reception and doctor, each making changes and waiting for the other to show them without interaction. One real interval, with a 20-second limit, proves SC-002. Everything about timing beyond that uses `page.clock` on the fake backend, which keeps the normal suite quick.

## R13. No JavaScript

The list needs JavaScript, as patient search and records do. The existing `noscript` notice covers this, and no change is needed.
