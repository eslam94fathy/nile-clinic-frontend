import type { PageMeta } from "@/lib/api/pagination";
import type { DateRangeProblem } from "@/lib/format/date-range";
import type { components } from "@/lib/api/generated/reports";

type Schemas = components["schemas"];

export type ReportDoctor = Schemas["Doctor"];
export type MoneyFigures = Schemas["MoneyFigures"];
export type MoneyCollected = Schemas["MoneyCollected"];
export type BillingFigures = Schemas["BillingFigures"];
export type ActivityFigures = Schemas["ActivityFigures"];
export type TimesFigures = Schemas["TimesFigures"];
export type AverageTime = Schemas["AverageTime"];

export type BillingRow = { doctor: ReportDoctor } & BillingFigures;
export type ActivityRow = { doctor: ReportDoctor } & ActivityFigures;
export type TimesRow = { doctor: ReportDoctor } & TimesFigures;
/** Left out by the API when a doctor is chosen, as it counts the whole clinic. */
export type ActivityTotals = ActivityFigures & { new_patients?: number };

/** A page of doctors, with totals that cover every doctor whichever page this is. */
export type ReportPage<Row, Totals> = {
  data: Row[];
  totals: Totals;
  meta: PageMeta;
};

/** The address's names, in tab order. `billing` is shown as "Charges by doctor" (clarification 3). */
export const REPORTS = [
  "money-collected",
  "billing",
  "activity",
  "times",
] as const;

export type Report = (typeof REPORTS)[number];

export function isReport(slug: string): slug is Report {
  return REPORTS.some((report) => report === slug);
}

export type ReportFilters = {
  from: string;
  to: string;
  doctorId: number | null;
  page: number;
  /** A period the API would refuse, so nothing is read (research R3). */
  rangeProblem: DateRangeProblem | null;
  /** Neither date was in the address, so the period moves with the clinic's calendar. */
  isDefaultPeriod: boolean;
};
