import type { ApiResult } from "@/lib/api/api-error";
import { browserApi } from "@/lib/api/browser-api";
import { checkResult, toQuery } from "@/lib/api/check-result";
import {
  activityPageSchema,
  billingPageSchema,
  moneyCollectedSchema,
  timesPageSchema,
} from "../schemas/reports";
import type {
  ActivityRow,
  ActivityTotals,
  BillingFigures,
  BillingRow,
  MoneyCollected,
  ReportFilters,
  ReportPage,
  TimesFigures,
  TimesRow,
} from "../types";

// None writes an audit entry, so each may read in the browser, on demand (ADR 0016). `per_page` is never sent, so
// the API's 15 applies, as on every other table. A caller never sends a period with a problem (research R3).

type Choices = Pick<ReportFilters, "from" | "to" | "doctorId">;
type PagedChoices = Choices & Pick<ReportFilters, "page">;

const period = ({ from, to, doctorId }: Choices) => ({
  from,
  to,
  doctor_id: doctorId ?? undefined,
});

export async function readMoneyCollected(
  choices: Choices,
  locale: string,
): Promise<ApiResult<MoneyCollected>> {
  const result = checkResult(
    await browserApi(`reports/money-collected${toQuery(period(choices))}`, {
      locale,
    }),
    moneyCollectedSchema,
  );
  return result.ok ? { ...result, data: result.data.data } : result;
}

function pagedQuery(choices: PagedChoices) {
  return toQuery({ ...period(choices), page: choices.page });
}

export async function readBillingReport(
  choices: PagedChoices,
  locale: string,
): Promise<ApiResult<ReportPage<BillingRow, BillingFigures>>> {
  return checkResult(
    await browserApi(`reports/billing${pagedQuery(choices)}`, { locale }),
    billingPageSchema,
  );
}

export async function readActivityReport(
  choices: PagedChoices,
  locale: string,
): Promise<ApiResult<ReportPage<ActivityRow, ActivityTotals>>> {
  return checkResult(
    await browserApi(`reports/activity${pagedQuery(choices)}`, { locale }),
    activityPageSchema,
  );
}

export async function readTimesReport(
  choices: PagedChoices,
  locale: string,
): Promise<ApiResult<ReportPage<TimesRow, TimesFigures>>> {
  return checkResult(
    await browserApi(`reports/times${pagedQuery(choices)}`, { locale }),
    timesPageSchema,
  );
}
