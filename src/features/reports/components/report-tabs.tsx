import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { periodOf, reportHref } from "../report-href";
import { REPORTS, type Report, type ReportFilters } from "../types";

/**
 * The four reports, each keeping the period and doctor, never the page (research R2). Prefetching is allowed:
 * nothing here is audited, and a prefetch fetches only the page, as the figures are read after it opens.
 */
export function ReportTabs({
  current,
  filters,
}: {
  current: Report;
  /** The whole set, so a test can show the page is dropped. */
  filters: ReportFilters;
}) {
  const t = useTranslations("reports.tabs");
  const period = periodOf(filters);

  return (
    <nav aria-label={t("label")}>
      <ul className="flex flex-wrap gap-1 border-b border-border">
        {REPORTS.map((report) => {
          const isCurrent = report === current;
          return (
            <li key={report}>
              <Link
                href={reportHref(report, {
                  period,
                  doctorId: filters.doctorId,
                })}
                aria-current={isCurrent ? "page" : undefined}
                className={
                  isCurrent
                    ? // Marked by its weight and a border, not by color alone.
                      "-mb-px inline-flex min-h-10 items-center border-b-2 border-primary px-3 font-semibold text-foreground"
                    : "inline-flex min-h-10 items-center px-3 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                }
              >
                {t(report)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
