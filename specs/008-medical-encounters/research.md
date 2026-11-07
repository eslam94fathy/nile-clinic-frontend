# Research: Medical Encounters

Findings from the backend's source and contract at commit `dff2dca`, this repository's code, and the installed Next.js 16.4.5's documentation. Nothing here has been run yet, unless it says so.

## R1. Reading a record or history

**Decision**: Use ADR 0012's guarded read: read in the browser on first mounting, after a click on a guarded link, or when the person asks, and otherwise never. Move its parts to shared code, and put patients on it with no change in behaviour.

**Why**: `GET /doctors/me/encounters/{id}` and `GET /doctors/me/patients/{id}/encounters` each write a permanent entry, exactly as `GET /patients/{id}` does, and ADR 0012 measured that a server read writes false entries after a refresh. ADR 0012 says this phase should start from it. Three features' worth of readers would otherwise repeat the same subtle code, and the constitution asks for extraction at the second consumer.

**What moves**:

| From | To |
|---|---|
| `features/patients/opening.ts`, its marks and handover | `lib/audited-opening.ts`, a small factory giving each feature its own |
| The ref, the mark, and the effect in `patient-record.tsx` | `lib/use-audited-read.ts` |
| `patient-link.tsx`'s click test | `components/shared/audited-link.tsx`, with `PatientLink` on top of it |

**A change's answer is the record.** `POST` to start, `PUT`, and finalize each return the whole record, and start hands it over to the reader through the same mechanism as registering a patient. An addendum returns only itself, and joins the list in state. None of these writes `encounter.opened` (source: `EncounterController`, where only `show` calls `open`).

**Alternatives**: TanStack Query for this read, rejected by ADR 0012, as an audited read has nothing for it to do. A server read, ruled out by that same measurement, and by FR-035.

## R2. Warning before unsaved text is lost

Nothing in the project does this yet. Next.js has no navigation-blocking API for the back button. `Link`'s `onNavigate` can stop a link, but would mean changing every link in the application, and the app shell's links don't know about this form.

| Route out | Approach | Known? |
|---|---|---|
| Any link, including the navigation and language switch | One capturing click listener on the document while there's something to lose. It stops the click, asks, and on "leave" clicks the same link again with the listener out of the way, so each link's own behaviour, including a guarded link's mark, still runs | From the DOM's rules. To be tested |
| Sign-out | The button asks the same store first, since it isn't a link | Yes |
| Closing the tab, reloading, leaving the site | `beforeunload`. The browser controls the wording | Yes |
| **Back and forward** | The Navigation API's `navigate` event, which can be cancelled, then `traverseTo` on leaving | Measured below |

**Measured** (2026-11-07, production build, Chromium, `e2e/encounters.spec.ts`), before anything was built on it:

| Approach | Result |
|---|---|
| Capturing `popstate`, stopping the router hearing it | **Failed.** No warning, and the router moved to the previous page. `popstate` arrived after the move had already taken effect, as a probe logged a `navigate` of type `replace` before it |
| The Navigation API's `navigate` event, of type `traverse`, with `preventDefault` | **Works.** 4 tests, 3 runs each: back warns; **Stay** keeps the address and every character; back can be pressed again; **Leave** reaches the previous page; history works normally afterwards; forward warns too |

**Decision**: use the Navigation API, with `traverseTo` to carry on after **Leave**. `popstate` isn't used.

**What this doesn't show.** Playwright's back isn't the browser's button. The event reported `cancelable: true` here, but a browser can refuse to let a traversal be cancelled if the person hasn't interacted with the page since the last one. A person who has typed has interacted, though this hasn't been tried by hand on the real button, so it's on quickstart's "By hand" list. A browser without the API, or one refusing, gives no warning. Next.js keeps a left page mounted, up to 3 routes, so the text is there on going forward again. So SC-008's back-button case holds in Chromium as measured, and elsewhere only as held text.

**"Leave" discards.** The form resets to what was last saved before leaving, so text the person chose to discard isn't held on a hidden page.

**The guard stands aside** when a session really ends, since the session-end functions use `location.replace`, which would otherwise prompt.

## R3. Saving

**Decision**: Every save sends all five keys, with an empty field as `null` and lines with no text left out. Nothing is sent when nothing has changed. After a save, the form takes the values the API returned.

**What counts as changed**: the request the form would send now, compared with the one that the last saved record would give. So trailing spaces and an empty line aren't changes. Laravel's default `TrimStrings` and `ConvertEmptyStringsToNull` apply, as `bootstrap/app.php` doesn't remove them, which the live suite confirms. The comparison also keeps `encounter.draft_saved` honest, though the API writes no entry for an identical save (`AuditTrail::recordChanges` returns when no field changed; `docs/backend-integration.md` H1 says otherwise, to be corrected once observed).

**A line's number**: the API's errors, such as `prescriptions.2.dosage`, count lines in the request. Lines with no text aren't sent, so `error-rows.ts` turns the request's number back into the line on screen. The same keys arrive from a finalize, against what was last saved, which is why a finalize always follows a save of what's on screen.

**No `maxLength`, and no length check in the schema.** A `maxLength` silently cuts pasted clinical text, which is the worst possible failure here. A JavaScript length also counts differently from the API's `max`, which counts characters rather than UTF-16 units. So the limit is a hint, and the API's `422` decides, keeping everything typed.

**Alternatives**: automatic saving, declined by the owner, who accepted what a crash loses.

## R4. Finalizing

`POST .../finalize` takes no body and locks what the API holds (`EncounterService::finalize`). So what's on screen must be saved first, or the doctor locks something other than what they read.

**Decision**: One confirmation, then up to two requests: `PUT` if anything changed, then `POST`. A refused save stops there. `useFormSubmit` allows one request at a time, so the two run as one submission. Refusals from either go through the same mapping.

**After**: the page shows what `POST` returned. If that differs from what was on screen, which only another tab could cause, a notice says so (FR-014).

**No completeness check in the form** (FR-015), as the API returns every missing field at once, and a copy of the rule could only disagree.

## R5. A `401` during a change

`browserApi` calls `endSession()` on a `401`, and returns a promise that never settles, so that no caller flashes an error while the page leaves. That would lose everything typed.

**Decision**: `browserApi` gains `{ answerSessionEnd: true }`. With it, a `401` returns as a failure, and nothing else happens. `saveEncounter`, `finalizeEncounter`, `addAddendum`, and the panel's two reads use it, as opening the panel with a dead session would otherwise lose the draft (analysis C2). The page then shows that the session ended and nothing was saved, keeps the text, and has a "Sign in" button that calls `endSession()`. Nothing else on the page reads while this shows.

**Another tab** used to send one message for every ending, which would lose a draft when "My queue" found a `401` in another tab (analysis C3). `session-end.ts` now sends two. **A sign-out** always leaves at once, losing what's unsaved: a person who signs out on a shared computer means it, and the clinical text must go with them. **A session that ended by itself** leaves at once, unless a form has something to lose, which then shows the same notice.

**A `403` or `404` on a change** doesn't refresh the page either (`useFormSubmit`'s `keepOnRefusal`, analysis C1), as a gate re-deciding would remove the form. The next navigation decides.

**The risk** is text staying on an unattended screen after a session ended, which the owner weighs in the privacy review. The fallback is removing the option, which is one line.

## R6. The panel

**Decision**: A plain labelled region beside the form, in a two-column layout using logical properties, stacking above the form on a narrow screen. It isn't a dialog, as the doctor must be able to read it and type at once, so nothing traps focus, and no sheet or drawer component is needed.

**Reads happen in click handlers, not effects.** The panel has no address, so it can't be reloaded, and nothing can re-run it. Opening it reads the history; choosing a row reads that record; closing it drops everything it held. A held page being shown again runs no handler, so it reads nothing, which is simpler than R1's guard and is tested the same way.

**Focus**: opening moves focus to the panel's heading, and closing returns it to the button that opened it. Choosing a record moves to its heading, and going back moves to the row.

**On a record with no draft**: the page offers the history as a link to its own page instead, since nothing can be lost.

## R7. "My queue"

Queue rows have no `encounter_id`, and `GET /doctors/me/visits` does, along with `record_status` (hazard H5). It writes no audit entry (`EncounterService::listVisits` has no audit call; `OwnVisitController` to be confirmed live).

**Decision**: A second `useLiveList` read of `GET /doctors/me/visits?from=today&to=today&per_page=100`, joined by id, under the queue's root key so an action refreshes both. ADR 0013's list of permitted reads gains it. Today comes from `clinicToday` with the clinic's time zone.

- A row with no match shows no status and no action, rather than guessing "none". Waiting patients never match, as the list leaves them out.
- A failure leaves the queue working, with a message in place of the statuses (FR-019).
- A doctor's list can't plausibly exceed 100 visits in a day. If it did, the later rows would show no status, and the API still decides.

**Refused start** (FR-004): the API answers `422` under `visit` for both "not started" and "already has a record", with no way to tell them apart and no id. So the page shows the message, and reads the list again, whose `encounter_id` offers the existing record.

**Finish notice**: `OwnQueueActions` gains the current visit's status, and adds a line to its dialog when it isn't `finalized` (FR-020). If the status isn't known, the line says nothing about it.

## R8. When a history is offered

A refused `GET` of a history writes a permanent refusal entry if the patient has any finalized record (`RecordRefusedOpening`, `recordRefusedHistory`). So the application's own links shouldn't lead to one.

The API allows a history when the patient is on this doctor's list today as waiting, with the doctor, or seen, or when this doctor has finalized records of them.

| Where | Offered when | Known from |
|---|---|---|
| "My queue" row | Status isn't `left` | The row |
| "My visits" row | Its record is `finalized`, or its patient is on today's list | The row, and `GET /doctors/me/queue` read once with the page |
| Read-only record | Always | The API just let this doctor read a finalized record of this patient, so it should allow the history too |
| Draft | Its patient is on today's list | `GET /doctors/me/queue`, read once with the page |

A record opened while the patient was on the list keeps offering the history after they've left, so that one click can write a refusal, which is true. This is accepted (analysis F2).

This is deliberately conservative. A draft from an earlier day, for a patient with older finalized records of this doctor's, offers no history, though the API would allow it, as `GET /doctors/me/visits` can only search 92 days, and walking back isn't worth it. The doctor can still reach it from a finalized visit in "My visits". If reading today's queue fails, nothing is offered on that basis.

## R9. Browser features

| Feature | Risk | Decision |
|---|---|---|
| Form history and autofill | Clinical text offered back later, on a shared computer | `autoComplete="off"` on the form and each field, and no `name` that suggests a known kind of data |
| Restoring a form after a reload or crash | The browser keeps typed text on disk | `autoComplete="off"` on the form is what stops it |
| Enhanced spell check | Chromium's optional service sends typed text to a remote server | `spellCheck={false}`. The doctor loses spelling help, which is the cost of keeping text off a third party |
| Writing suggestions | Browsers' writing help | `writingsuggestions="false"` |
| Common extensions | Grammar extensions read fields | `data-gramm="false"`, and `data-enable-grammarly="false"`. An extension can ignore these, which the review records as beyond the application |
| Submitting before hydration | Text in the address | `method="post"` on the form, as `docs/development-guidelines.md` requires, and disabled until hydrated |
| Translation | The browser sends a page's text to a translation service | `translate="no"` on clinical text, which also respects Principle VII's "never translated" |

## R10. Showing clinical text

`ClinicalText` renders as text, never markup, with `dir="auto"`, `whitespace-pre-wrap`, and the same wrapping as `UserText`. React escapes it, and `dangerouslySetInnerHTML` is already banned. A test plants markup, and confirms it shows as text.

## R11. Where each read runs

| Read | Where | Why |
|---|---|---|
| "My visits" | Server, under ADR 0011 | It holds no clinical content and writes no entry, as `/my/appointments` does |
| Own doctor's number | Server | The same `GET /doctors/me` the gate reads |
| A record, a history | Browser only | R1, FR-035 |
| Today's queue on "My queue" | Browser, live | ADR 0013 |
| Today's queue with "My visits" or a draft | Browser, once | R8. It's unaudited, and only decides what's offered |

**The server path is clean today**: the same-origin route sends `no-store` on every answer and logs nothing; the only `console` calls in `src` are configuration errors at startup; and `next.config.ts` has `logging: { incomingRequests: false }`. The route passes request bodies through unread.

**Page titles** stay generic, with no patient name, as `docs/development-guidelines.md` already requires.

## R12. The privacy review

**Decision**: `specs/008-medical-encounters/privacy-review.md`, written after the live suite passes, because FR-046 requires observed evidence. It holds, for each area in FR-045: what was checked, how, what was found, and what's left open.

It has to put these to the owner by name: an unattended screen, text kept after a session ends, a crash losing typing, a hidden page holding clinical text, a browser or extension beyond the application's reach, printing, and another tab overwriting a draft. It also lists what the legal review before production must settle.

**Evidence**: `e2e/live/encounters.spec.ts` plants a distinct synthetic marker in every clinical field, then searches every address visited, every page title, `localStorage`, `sessionStorage`, IndexedDB, Cache Storage, the application server's output, and the audit trail. It uses the same method as `e2e/live/appointments.spec.ts`. It also searches the HTML the server sends for a clinical page, to confirm FR-035.

**Limits to state honestly**: the search can't see the browser's own disk cache or form-restore files directly. Those rest on `no-store`, `autoComplete="off"`, and the browser honouring them.

## R13. The fake backend

It gains encounters in `e2e/support/fake-clinic.mjs`, following the contract, with the seven operations, its refusals, the access rule, and a request count for each audited read, so that "no read happened" can be asserted without the Docker API.
