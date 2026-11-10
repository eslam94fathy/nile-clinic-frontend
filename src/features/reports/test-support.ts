// Synthetic report figures for tests. None of it describes a real clinic.
import type { DateRange } from "@/lib/format/date-range";
import type { ReportChoicesProps } from "./components/report-choices";
import { reportShortcuts } from "./shortcuts";
import type {
  ActivityFigures,
  ActivityRow,
  BillingFigures,
  BillingRow,
  MoneyCollected,
  Report,
  ReportFilters,
  TimesFigures,
  TimesRow,
} from "./types";

export const TODAY = "2026-11-08";

export const THIS_MONTH: ReportFilters = {
  from: "2026-11-01",
  to: TODAY,
  doctorId: null,
  page: 1,
  rangeProblem: null,
  isDefaultPeriod: true,
};

export const DOCTORS = [
  { id: 3, name: "Synthetic Doctor", is_active: true },
  { id: 4, name: "Synthetic Retired", is_active: false },
];

export function aChoices(
  report: Report,
  filters: Partial<ReportFilters> = {},
  overrides: Partial<ReportChoicesProps> = {},
): ReportChoicesProps {
  const shortcuts = reportShortcuts(TODAY);
  const defaultPeriod: DateRange = shortcuts.thisMonth;
  return {
    report,
    filters: { ...THIS_MONTH, ...filters },
    doctors: DOCTORS,
    shortcuts,
    currentShortcut: "thisMonth",
    defaultPeriod,
    ...overrides,
  };
}

export const aMoneyCollected = (
  changes: Partial<MoneyCollected> = {},
): MoneyCollected => ({
  from: "2026-11-01",
  to: TODAY,
  totals: { received: "1234567.89", refunded: "400.00", net: "1234167.89" },
  by_method: [
    {
      method: "cash",
      received: "350.00",
      refunded: "400.00",
      net: "-50.00",
      staff: [
        {
          id: 2,
          name: "Synthetic Reception",
          received: "350.00",
          refunded: "0.00",
          net: "350.00",
        },
      ],
    },
  ],
  by_day: [
    { date: "2026-11-02", received: "350.00", refunded: "0.00", net: "350.00" },
    {
      date: "2026-11-05",
      received: "0.00",
      refunded: "400.00",
      net: "-400.00",
    },
  ],
  ...changes,
});

const meta = (total: number, page = 1, lastPage = 1) => ({
  current_page: page,
  last_page: lastPage,
  per_page: 15,
  total,
  from: total ? 1 : null,
  to: total ? total : null,
});

export const doctor = { id: 3, name: "Synthetic Doctor", title: "Consultant" };

export const aBillingFigures = (
  changes: Partial<BillingFigures> = {},
): BillingFigures => ({
  active_charges: 2,
  fees: "700.00",
  discounts: "50.00",
  amount_due: "650.00",
  amount_paid: "300.00",
  balance: "350.00",
  cancelled_charges: 1,
  uncharged_seen_visits: 1,
  ...changes,
});

export const aActivityFigures = (
  changes: Partial<ActivityFigures> = {},
): ActivityFigures => ({
  appointments: {
    scheduled: 1,
    cancelled: 2,
    no_show: 3,
    checked_in: 4,
    completed: 5,
  },
  no_show_rate: 25,
  visits: {
    waiting: 6,
    with_doctor: 7,
    seen: 8,
    // The backend's status, not a position. Computed, so the logical-styles check can stay strict.
    ["left"]: 9,
    booked: 10,
    walk_in: 11,
  },
  ...changes,
});

export const aTimesFigures = (
  changes: Partial<TimesFigures> = {},
): TimesFigures => ({
  wait: { average_minutes: 12, visits: 40 },
  consultation: { average_minutes: null, visits: 0 },
  records: { finalized: 5, draft: 1, none: 0 },
  ...changes,
});

export function aPage<Row, Totals>(
  rows: Row[],
  totals: Totals,
  page = 1,
  lastPage = 1,
) {
  return { data: rows, totals, meta: meta(rows.length, page, lastPage) };
}

export const aBillingRow = (): BillingRow => ({
  doctor,
  ...aBillingFigures(),
});
export const aActivityRow = (): ActivityRow => ({
  doctor,
  ...aActivityFigures(),
});
export const aTimesRow = (): TimesRow => ({ doctor, ...aTimesFigures() });
