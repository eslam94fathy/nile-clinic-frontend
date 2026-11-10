import { cleanup, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messagesByLocale } from "@/test-support/render-with-intl";
import { aPage, aTimesFigures, aTimesRow } from "../test-support";
import { ok, renderReport } from "./paged-reports.test-setup";

const readTimesReport = vi.hoisted(() => vi.fn());
vi.mock("../api/reports", () => ({ readTimesReport }));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/reports/times",
  Link: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const { reports: t } = messagesByLocale.en;
const figureNamed = async (label: string) => {
  const heading = await screen.findByRole("heading", { name: t.allDoctors });
  return within(heading.closest("section") ?? document.body).getByText(label)
    .nextSibling?.textContent;
};

beforeEach(() => readTimesReport.mockReset());
afterEach(cleanup);

describe("TimesReport", () => {
  it("gives averages in whole minutes with the visits they cover", async () => {
    readTimesReport.mockResolvedValue(
      ok(aPage([aTimesRow()], aTimesFigures())),
    );
    renderReport("times");

    expect(await figureNamed(t.times.wait)).toBe("12 minutes, over 40 visits");
    expect(screen.getByText(t.times.note)).toBeTruthy();
  });

  it("says a missing average isn't available, never zero", async () => {
    readTimesReport.mockResolvedValue(ok(aPage([], aTimesFigures())));
    renderReport("times");

    expect(await figureNamed(t.times.consultation)).toBe(
      `${t.notAvailable}, over 0 visits`,
    );
  });

  it("marks drafts and missing records above zero", async () => {
    readTimesReport.mockResolvedValue(
      ok(
        aPage(
          [],
          aTimesFigures({ records: { finalized: 2, draft: 1, none: 0 } }),
        ),
      ),
    );
    renderReport("times");

    expect(await figureNamed("Seen visits: Draft")).toBe(
      `1${t.needsAttention}`,
    );
    expect(await figureNamed("Seen visits: No record")).toBe("0");
  });

  it("gives each doctor's row", async () => {
    readTimesReport.mockResolvedValue(
      ok(aPage([aTimesRow()], aTimesFigures())),
    );
    renderReport("times");

    const table = within(await screen.findByRole("table"));
    expect(table.getByText("Synthetic Doctor")).toBeTruthy();
    expect(table.getAllByRole("columnheader")).toHaveLength(6);
  });

  it("shows the empty state with no visits", async () => {
    readTimesReport.mockResolvedValue(ok(aPage([], aTimesFigures())));
    renderReport("times");

    expect(await screen.findByText(t.times.emptyTitle)).toBeTruthy();
  });
});
