// Shared set-up for the three per-doctor reports' tests.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithIntl } from "@/test-support/render-with-intl";
import { aChoices } from "../test-support";
import type { Report, ReportFilters } from "../types";
import { ReportView } from "./report-view";

export const ok = (data: unknown) => ({ ok: true, status: 200, data });

/** `Intl` puts a no-break space inside an amount. */
export const plain = (text: string | null | undefined) =>
  (text ?? "").replace(/\s/g, " ");

export function renderReport(
  report: Report,
  filters: Partial<ReportFilters> = {},
  locale: "en" | "ar" = "en",
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retryDelay: 1 } },
  });
  return renderWithIntl(
    <QueryClientProvider client={client}>
      <ReportView choices={aChoices(report, filters)} timeZone="Africa/Cairo" />
    </QueryClientProvider>,
    locale,
  );
}
