# Screens: Audit Log

One page, `/{locale}/audit`, administrators only, with no query string ever.

## Layout

1. **Page header**: "Audit log", with a description: the trail of what staff did, kept permanently.
2. **Notice** (always shown): each search, and each page of it, is itself recorded in the trail under your name. Names are staff members'
   current names.
3. **Filters** (`FilterBar`, every filter `inAddress: false`, apply label "Search", reset label "Clear"):
   - From, To (dates)
   - Staff member (select, all accounts, deactivated marked; a number field if the list couldn't be read). Hint: matches who acted and whose
     account it was
   - Patient number (text, numeric input mode)
   - Record type (select of 9), Record number (text). Hint: both together
   - Action (select, grouped)
   - Outcome (select: succeeded, refused)
4. **Results** region (focusable, `aria-live="polite"` for its status line), then `CursorPager`.

## States

| State | When | Shows |
|---|---|---|
| Before search | Opened, or after Clear | Empty state: "Choose filters, or none, and select Search to see entries" |
| Loading | A Search running | Loading state in the results; Search shows progress and is disabled |
| Moving | Older or Newer running | The page shown stays, dimmed and `aria-busy`; the pressed button shows progress; both disabled |
| Success | Entries | The entries; the pager; "Newest entries" when there's no `prev_cursor` |
| Empty | No entries | "No entries match these filters", keeping the filters |
| Out of date | The form differs from the filters shown | A line above the results: "These results are for the previous search. Select Search to apply your changes." |
| Field problems | Client check or `422` with field keys | On each filter; others at form level; nothing else changes |
| Position refused | `422` on `cursor` | The page stays, with a message and "Start again from the newest" |
| Error | No answer or `5xx` on Search | Error state with Try again |
| Move failed | No answer or `5xx` on Older or Newer | The page stays, with "This page couldn't be changed" and Try again |
| Forbidden | Gate, or a `403` from the search | Forbidden state; results cleared |
| Session ended | `401` | The app's sign-in flow; nothing returns here automatically |

## An entry

Summary line:

- Time, in the clinic's time zone, with seconds (`<time>`, isolated left to right).
- Action, translated (or as sent).
- Outcome: "Succeeded" or "Refused", as a status badge with text; refused uses the warning tone.
- Who: staff name (link to `/staff/{id}`) and "role at the time: …"; or "The system"; or "Unknown (no account matched)".

Details (description list; each absent value reads "None"):

- Record: type, translated, and number (linked per contracts/api-usage.md).
- Patient: number, through `PatientLink`.
- Network address, isolated left to right.
- Changed: each field name; for a field with values, "before → after" in reading order, each per data-model.md `describeValue`.
- For `audit.searched`: "Filters used" as label and value pairs, or "No filters".
- For a refused `auth.sign_in` with a staff actor: "The account named is the one targeted, not necessarily who tried."

## `CursorPager` (shared)

`<nav aria-label="Pages">` with "Newer" and "Older" buttons, in reading order (Newer first), each disabled with nothing in its direction
or while `busy`, the pressed one showing progress. Optional "Newest entries" text. No total, no numbers. Logical layout only.
