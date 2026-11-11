# API Usage: Role Dashboards

**Feature**: 012-role-dashboards | **Backend**: commit `dff2dca`

Every request goes through the same-origin route `/api/backend/...` with the person's locale. All are `GET`. None writes an audit entry
(research, Facts). `T` is the clinic's today when the read runs.

| # | Request | Role | Contract | Used for |
|---|---|---|---|---|
| 1 | `appointments?from=T&to=T&status=scheduled&per_page=5` | R | `006` `listAppointments` | Still to arrive, with rows |
| 2–4 | `appointments?from=T&to=T&status={checked_in,completed,no_show}&per_page=1` | R | `006` | Arrived, completed, no-show |
| 5–8 | `queue?status={waiting,with_doctor,seen,left}&per_page=1` | R | `007` `listClinicQueue` | Queue by status |
| 9–11 | `visits?date=T&charge_status={none,unpaid,partially_paid}&per_page=1` | R | `009` `listVisitCharges` | Money owed |
| 12 | `appointments?from=T&to=T%2B90&outside_availability=1&per_page=5` | R, A | `006` | Needing a move |
| 13 | `doctors/me/queue` | D | `007` `listOwnQueue` | With me now, waiting |
| 14 | `doctors/me/appointments?from=T&to=T&status=scheduled&per_page=5` | D | `006` `listOwnAppointments` | Next appointments |
| 15–16 | `doctors/me/visits?from=T-91&to=T&record_status={none,draft}&per_page=1` | D | `008` `listOwnVisits` | Records |
| 17 | `reports/money-collected?from=T&to=T` | A | `010` `getMoneyCollected` | Money today |
| 18 | `reports/activity?from=T&to=T` | A | `010` `getActivity` | Activity today |

`outside_availability` is sent as `1`, as the Appointments screen does; Laravel's boolean rule accepts it.

## Answers handled

| Status | Where | Panel shows |
|---|---|---|
| `200` | all | Figures; a body failing its schema is treated as a failed read (`checkResult`) |
| `401` | all | The app's session-end flow, through `browserApi` |
| `403` | all | Forbidden state; data cleared; reading stops |
| `404` | 13–16 (`DoctorNotFound`), 17–18 (`NotFound`, doctor filter, never sent here) | Not-found state; data cleared; reading stops |
| `422` | any range or filter | Failed state with the API's message. Never expected: every range is within limits, and the unit tests check each query |
| `5xx`, no answer | all | Failed, or out of date if figures were shown; one retry for live reads (`retryLiveRead`) |

## Never requested

`GET /patients/{id}`, `GET /doctors/me/encounters/{id}`, `GET /doctors/me/patients/{id}/encounters`, `GET /audit-entries`, and any
non-`GET` method. A unit test checks the dashboard API module's paths against this list, and the e2e suite fails on any such request
while a dashboard is open.
