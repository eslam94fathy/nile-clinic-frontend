# Screens: Reports

One page, `/reports/[[...report]]`, for administrators. `/reports` is Money collected. Every state is
in English and Arabic, both directions, and both themes.

## Shared frame

| Part | Contents |
|---|---|
| Header | "Reports" and a one-line description |
| Tabs | Money collected, Charges by doctor, Activity, Times: links carrying `from`, `to`, `doctor_id`; the current one marked with `aria-current="page"` |
| Choices | From, To, Doctor (all doctors by default; inactive ones labelled), Apply, Reset; then the four shortcuts as links |
| Period line | "1 Nov 2026 to 8 Nov 2026", and the doctor's name when one is chosen |
| `LastRead` | When the figures were read, in the clinic's time zone, **Refresh**, and the out-of-date notice |

Below these, each report's own content and states ([research R7](../research.md)).

## Money collected

1. Totals: received, refunded, net.
2. Note: with a doctor, "Only money on this doctor's charges is counted."
3. "By day": the chart, then a table of date, received, refunded, net.
4. "By method": a section per method with its totals and a table of staff: name, received, refunded, net.
5. Empty: "No money was received or refunded in this period."

## Charges by doctor (`/reports/billing`)

1. Totals for all doctors: active charges, fees, discounts, amount due, amount paid, balance, cancelled charges, uncharged seen visits.
2. Note: "Cancelled charges are counted only, and are in no amount."
3. Table, one row per doctor: doctor, then the same eight figures. Uncharged seen visits above zero carry "Needs attention".
4. Empty: "Nothing was charged in this period, and no visit was left uncharged."

## Activity

1. Totals for all doctors: the five appointment counts, the no-show rate, the four visit counts, booked and walk-in, and new patients, or
   the note that new patients is for the whole clinic.
2. Note: how the no-show rate is worked out.
3. Table, one row per doctor: doctor, appointment counts, rate, visit counts, booked, walk-in.
4. Empty: "No appointments or visits in this period."

## Times

1. Totals for all doctors: average wait and the visits it covers, average consultation and the visits it covers, seen visits with a
   finalized record, a draft, and none.
2. Note: "Overall averages are worked out from every visit, not from the doctors' averages."
3. Table, one row per doctor: doctor, then the same figures. Drafts and no record above zero carry "Needs attention".
4. Empty: "No visits in this period."

## States common to all four

| State | Shown |
|---|---|
| Choice problem | The message on From or To; no read; the last figures are not shown |
| Loading | Skeleton below the choices |
| Error | "The report couldn't be read." with **Try again** |
| Forbidden | The shared forbidden state |
| Unknown doctor | "That doctor wasn't found." with "Show all doctors", a link to the same report and period |
| Out of date | The figures, with the notice |
| Empty | Zero totals, then the report's empty message |
