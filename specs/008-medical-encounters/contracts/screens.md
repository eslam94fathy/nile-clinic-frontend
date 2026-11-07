# Screens: Medical Encounters

Every screen is for doctors only, behind `ScreenGate` with `medicalRecords`. Other roles get the not-allowed state with no read, and a doctor with no profile gets "profile not set up" with no further read. Links here use `prefetch={false}`. Titles are generic, and never hold a patient's name.

## `/my/visits`

| State | What shows |
|---|---|
| Loading | The page's loading state |
| Success | Filters, and a table: date, patient, walk-in, times, record status as text, and an action. API order, no sorting |
| Empty | Neutral words, keeping the filters |
| Error | `ApiFailureState`. A `422` under `from` or `to` shows on that filter |

Row actions: **Start record** for `none`, **Continue** for `draft`, **Open** for `finalized`. **History** as [R8](../research.md) allows. Showing, filtering, or hovering reads no record.

If today's queue can't be read, history is offered only on finalized rows, with no message, as nothing else is affected.

## `/my/queue` (changed)

Phase 7's page, plus:

- The current patient shows the record's status, with **Start record**, **Continue**, or **Open**.
- Rows with the doctor or seen show the status, and the same actions. Rows that aren't `left` offer **History**.
- Status not known: nothing shown, no action. A failed read gives one message, and the queue works on.
- The finish dialog adds a line when the status is `none` or `draft`, saying the record isn't finalized and can be completed later. It doesn't block.
- Calling a patient starts nothing.

## `/my/encounters/[id]`

The reader decides what follows.

| State | What shows |
|---|---|
| Loading | The loading state, while the one read happens |
| Not found, `404` | One neutral state, with a link to "My visits". No hint of whether it exists |
| Not allowed, `403` | The not-allowed state |
| Failed | The message, and "Try again", which is a person's action and writes a true entry if it succeeds |
| Draft | The form below |
| Finalized | The view below |

### Draft: the form

Header: patient's number, name, sex, date of birth; the visit's date; "Draft"; when it was started and last saved.

Fields: chief complaint, examination findings, diagnosis, treatment plan, and prescription lines with **Add line** and **Remove**. Each carries its limit as a hint, and R9's browser settings. A sentence explains that nothing saves by itself.

Actions: **Save**, **Finalize**, **History** if offered.

| State | What shows |
|---|---|
| Everything saved | "Saved", with the time |
| Unsaved changes | "Unsaved changes" as text, always visible |
| Saving | Progress, both buttons disabled, and fields read-only, keeping focus |
| Saved | A confirmation with no clinical text, and the notice clears |
| Refused | Messages on fields, or at form level, and everything typed stays |
| Answer never came | Says it isn't known whether it saved, and that saving again is safe. Everything typed stays |
| `500` | Says nothing was saved. Everything typed stays |
| Session ended | Says the session ended and nothing was saved, keeps the text, and offers **Sign in** |
| Finalized elsewhere | The API's message, the text stays, and **Open the record as it now stands**, read only, in the panel |
| Not found or not allowed | The message, the text stays, and no further save is offered |

### Finalize

Dialog: can't be undone, corrections only by addendum, doesn't finish the visit. It opens on the safe choice.

| State | What shows |
|---|---|
| Working | Progress, through both steps |
| Save refused | Dialog closes, messages on fields, nothing finalized |
| Something required missing | Dialog closes, each message on its field or line, still a draft |
| Accepted | A confirmation, and the view below, focus on its heading |
| Differs from the screen | Also a notice that what was locked isn't what was on screen, which another tab can cause |
| Answer never came | Says it isn't known. Offers **Open the record**, a person's action, and warns it writes an opening. Text stays |

### Leaving with unsaved text

Dialog, on any link, the back button if R2 holds, and sign-out: what's unsaved will be lost, with **Stay**, which is the safe choice, and **Leave without saving**. Closing or reloading gets the browser's own prompt. After **Leave**, the form returns to what was last saved.

### Finalized: the view

Header as above, with the author's name and title, and "Finalized" with its time. Then each field as written, with empty ones labelled as empty, and prescription lines. Addenda follow, oldest first, each with its time.

Author only: **Add an addendum**. Dialog: it can't be changed or removed, only followed by another.

| Addendum state | What shows |
|---|---|
| Empty, none yet | "No addenda" |
| Working | Progress, and the field locked |
| Accepted | A confirmation, joins the list, field empties, no further read |
| Refused | Message on the field, text stays |
| Answer never came | Says it isn't known, and that adding it again could add it twice. Offers **Open the record** |
| Session ended | As the draft does |

Another doctor's record offers nothing to change. **Reload** is offered, saying it writes an entry.

## `/my/patients/[id]/history`

| State | What shows |
|---|---|
| Loading | The loading state, while the one read happens |
| Success | The patient's name if the link that opened the page passed it, in memory only, otherwise only their number, as a history has no name; rows of date, doctor, and specialties in this language, each opening the record; paging, each page a person's action |
| Empty | Neutral: no records can be shown |
| Not found | One neutral state, the same words whether or not records exist |
| Failed | The message, and "Try again" |

## The panel

Beside the draft; above it on a narrow screen. A labelled region, not a dialog.

| State | What shows |
|---|---|
| Closed | Nothing read. A **History** button, if offered |
| Reading | A loading state in the panel only |
| History | As the page, with rows as buttons that open in the panel |
| Record | The read-only view, with **Back to history**. Never offers a change |
| Empty, not found, failed | As the page, inside the panel, and the form is untouched |

Closing drops everything it held, and returns focus. Opening again reads again, writing a true entry. Nothing typed in the form is ever affected.

## Text and announcements

- Confirmations and announcements never repeat clinical text.
- Refreshes on "My queue" aren't announced, as in Phase 7.
- Every status is text, and never colour alone.
