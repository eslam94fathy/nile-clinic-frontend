import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { LiveQueryProvider } from "@/components/shared/live/live-query-provider";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/states/loading-state";
import { NotFoundState } from "@/components/shared/states/not-found-state";
import { ScreenGate } from "@/features/auth/public-server";
import { readAllDoctors } from "@/features/doctors/api/doctors-server";
import { ReportTabs } from "@/features/reports/components/report-tabs";
import { ReportView } from "@/features/reports/components/report-view";
import { readReportFilters } from "@/features/reports/read-report-filters";
import { currentShortcut, reportShortcuts } from "@/features/reports/shortcuts";
import { isReport, type Report } from "@/features/reports/types";
import { firstParam } from "@/lib/api/read-resource";
import { getEnv } from "@/lib/config/env";
import { clinicToday } from "@/lib/format/clinic-today";
import { ScopedMessages } from "@/lib/i18n/scoped-messages";

type Params = Promise<{ locale: string; report?: string[] }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** `/reports` is Money collected, so the one navigation entry opens the first report with no redirect. */
function reportOf(segments: string[] | undefined): Report | null {
  if (segments === undefined || segments.length === 0) {
    return "money-collected";
  }
  const [slug = ""] = segments;
  return segments.length === 1 && isReport(slug) ? slug : null;
}

async function Reports({
  locale,
  report,
  searchParams,
}: {
  locale: string;
  report: Report;
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: "reports" });
  const timeZone = getEnv().CLINIC_TIMEZONE;
  // The clinic's calendar, never the computer's: the default period and the shortcuts come from it (FR-005).
  const today = clinicToday(timeZone);
  const filters = readReportFilters(
    {
      from: firstParam(query.from),
      to: firstParam(query.to),
      doctor_id: firstParam(query.doctor_id),
      page: firstParam(query.page),
    },
    today,
  );
  const shortcuts = reportShortcuts(today);
  const doctors = await readAllDoctors(locale);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <ScopedMessages locale={locale} namespaces={["reports", "auth"]}>
        <ReportTabs current={report} filters={filters} />
        <LiveQueryProvider>
          <ReportView
            choices={{
              report,
              filters,
              doctors: doctors.ok
                ? doctors.data.map(({ id, name, is_active }) => ({
                    id,
                    name,
                    is_active,
                  }))
                : null,
              shortcuts,
              currentShortcut: currentShortcut(filters, shortcuts),
              defaultPeriod: shortcuts.thisMonth,
            }}
            timeZone={timeZone}
          />
        </LiveQueryProvider>
      </ScopedMessages>
    </>
  );
}

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { locale, report: segments } = await params;
  setRequestLocale(locale);
  const report = reportOf(segments);

  return (
    <Suspense fallback={<LoadingState />}>
      <ScreenGate locale={locale} path="reports">
        {report === null ? (
          <NotFoundState />
        ) : (
          <Reports
            locale={locale}
            report={report}
            searchParams={searchParams}
          />
        )}
      </ScreenGate>
    </Suspense>
  );
}
