// Where each panel and figure leads (research R7). Every address is a screen that reads its filters from the address,
// with the same defaults the dashboard counts with, so a figure and the list it opens agree. None is a patient's record
// or a medical record, which would write an entry when opened.

const withQuery = (path: string, query: Record<string, string>) =>
  `${path}?${new URLSearchParams(query).toString()}`;

type QueueStatus = "waiting" | "with_doctor" | "seen" | "left";
type OwedStatus = "none" | "unpaid" | "partially_paid";

export const dashboardLinks = {
  /** Today is the screen's default range. */
  appointmentsToArrive: withQuery("/appointments", { status: "scheduled" }),
  /** Today to today + 90 is the screen's default range for this filter. */
  appointmentsToMove: withQuery("/appointments", { outside_availability: "1" }),
  appointment: (id: number) => `/appointments/${id}`,
  queue: "/queue",
  queueByStatus: (status: QueueStatus) => withQuery("/queue", { status }),
  /** Today is the screen's default date. */
  billing: "/billing",
  billingByStatus: (status: OwedStatus) =>
    withQuery("/billing", { charge_status: status }),
  ownQueue: "/my/queue",
  ownAppointmentsToArrive: withQuery("/my/appointments", {
    status: "scheduled",
  }),
  ownAppointment: (id: number) => `/my/appointments/${id}`,
  /** Before the first read, when the period isn't known yet. */
  ownVisitsDefault: "/my/visits",
  /** Dates are stated, as the screen's own default is 30 days, not 92. */
  ownVisits: (from: string, to: string, recordStatus: "none" | "draft") =>
    withQuery("/my/visits", { from, to, record_status: recordStatus }),
  moneyCollectedToday: (today: string) =>
    withQuery("/reports/money-collected", { from: today, to: today }),
  activityToday: (today: string) =>
    withQuery("/reports/activity", { from: today, to: today }),
} as const;
