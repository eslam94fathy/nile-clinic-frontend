# Screens: Role Dashboards

**Feature**: 012-role-dashboards

One page, `/{locale}/dashboard`, behind `ScreenGate` with `path="dashboard"` (unchanged). The welcome heading stays at the top
(FR-001). Below it, the role's panels in a responsive grid: one column at narrow widths, two at desk widths. Logical CSS only.

## Names

The spec's terms and the panel headings refer to the same things: "appointments needing a move" is the panel **Appointments to
move**, and "visits lacking a record" (no record, or an unfinished draft) is the panel **Records to finish**. Requirements keep
the spec's terms; headings use the panel names.

## Panel frame (shared by every panel)

```text
┌ Heading ─────────────────────────────── [Open <screen>] ┐
│ Figures: label + number, as a list of terms (dl)         │
│ Optional short list (5 rows) + "and N more"              │
│ Last read 10:42 · [Refresh]      (LastRead, per panel)   │
└──────────────────────────────────────────────────────────┘
```

- Each panel is a `section` labelled by its heading, so a screen reader can move between them.
- Figures are text: a label and a number. Status figures use the same words as the owning screen's filter.
- `LastRead` is per panel. On the administrator's dashboard it says the figures don't refresh by themselves (`retriesBySelf={false}`).

## States, per panel

| State | Shown |
|---|---|
| Loading | Heading, then a skeleton of the figures; other panels unaffected |
| Shown | Figures, list, link, last read |
| Empty | Figures as `0`, and a sentence: "Nobody is waiting", "No appointments still to arrive today", "No money recorded today", "No appointments need moving", "Nobody is with you", "No visits lack a record in the last 92 days" |
| Out of date | Figures kept, with `LastRead`'s warning notice |
| Failed | "This couldn't be loaded" with Try again; nothing else on the page changes |
| Forbidden | The shared `ForbiddenState`, as it is, inside the panel |
| Not found | The shared `NotFoundState`, as it is, inside the panel. On the doctor's dashboard, "Your doctor profile couldn't be found", pointing to an administrator |

Whole-page states stay with `ScreenGate`: no session, service unavailable, doctor without a profile.

## Receptionist

| Panel | Figures | List | Link |
|---|---|---|---|
| Today's appointments | Still to arrive, Arrived, Completed, No-show | Next 5 still to arrive: time, patient, doctor | Appointments |
| Queue now | Waiting, With a doctor, Seen, Left | none | Queue; each figure links to its status |
| Money owed today | Not charged, Unpaid, Partly paid | none | Billing; each figure links to its filter |
| Appointments to move | Total, with "today to {date}" | Soonest 5: date, time, patient, doctor | Appointments needing a move |

## Doctor

| Panel | Figures | List | Link |
|---|---|---|---|
| With you now | none | The patient: name, queue number, called at | My queue |
| Waiting | Waiting | All waiting, in queue order: number, name (not capped at five; the API returns the whole list) | My queue |
| Later today | none | Next 5 appointments still to arrive: time, patient, each linking to its own page | My appointments |
| Records to finish | No record, Draft not finalized, with "{from} to {to}" | none | My visits, filtered |

No call-next, finish, or record buttons: those stay on My queue (US2 scenario 5).

## Administrator

| Panel | Figures | List | Link |
|---|---|---|---|
| Money today | Received, Refunded, Net; received by method | none | Money collected report for today |
| Activity today | Appointments by status; visits waiting, with a doctor, seen, left; booked, walk-in; new patients; no-show rate | none | Activity report for today |
| Appointments to move | as the receptionist's | as the receptionist's | as the receptionist's |

## Messages

New namespace `dashboard` in `messages/{en,ar}.json`: panel headings, figure labels, empty sentences, period phrases, link labels, and
"and {count} more". Statuses, methods, and roles reuse existing keys. Around 60 keys per locale.
