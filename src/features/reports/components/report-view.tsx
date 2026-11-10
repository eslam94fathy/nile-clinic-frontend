"use client";

import { ActivityReport } from "./activity-report";
import { BillingReport } from "./billing-report";
import { MoneyCollectedReport } from "./money-collected-report";
import { ReportChoices, type ReportChoicesProps } from "./report-choices";
import { TimesReport } from "./times-report";

const REPORT_COMPONENTS = {
  "money-collected": MoneyCollectedReport,
  billing: BillingReport,
  activity: ActivityReport,
  times: TimesReport,
} as const;

/**
 * With a period problem, only the choices: the report that reads isn't mounted, so nothing can be sent until it's
 * corrected (research R2). Otherwise the report, which holds its own choices so the API's refusal reaches them.
 */
export function ReportView({
  choices,
  timeZone,
}: {
  choices: ReportChoicesProps;
  timeZone: string;
}) {
  if (choices.filters.rangeProblem) return <ReportChoices {...choices} />;

  const Report = REPORT_COMPONENTS[choices.report];
  return <Report choices={choices} timeZone={timeZone} />;
}
