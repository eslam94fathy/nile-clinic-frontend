import { cleanup, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messagesByLocale } from "@/test-support/render-with-intl";
import { aBillingFigures, aBillingRow, aPage } from "../test-support";
import { ok, plain, renderReport } from "./paged-reports.test-setup";

const readBillingReport = vi.hoisted(() => vi.fn());
vi.mock("../api/reports", () => ({ readBillingReport }));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/reports/billing",
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

beforeEach(() => {
  readBillingReport.mockReset();
  router.replace.mockReset();
});
afterEach(cleanup);

describe("BillingReport", () => {
  it("heads one doctor's totals as that doctor's, not all doctors'", async () => {
    readBillingReport.mockResolvedValue(
      ok(aPage([aBillingRow()], aBillingFigures())),
    );
    renderReport("billing", { doctorId: 3 });

    expect(
      await screen.findByRole("heading", { name: t.thisDoctor }),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: t.allDoctors })).toBeNull();
  });

  it("shows the totals for all doctors apart from the rows", async () => {
    readBillingReport.mockResolvedValue(
      ok(
        aPage(
          [aBillingRow()],
          aBillingFigures({ fees: "9999.00", uncharged_seen_visits: 3 }),
        ),
      ),
    );
    renderReport("billing");

    const heading = await screen.findByRole("heading", { name: t.allDoctors });
    const totals = within(heading.closest("section") ?? document.body);
    expect(plain(totals.getByText(/9,999\.00/).textContent)).toBe(
      "EGP 9,999.00",
    );
    expect(totals.getByText(t.needsAttention)).toBeTruthy();
    expect(screen.getByText(t.billing.note)).toBeTruthy();
  });

  it("gives each doctor's row with the name and title as stored", async () => {
    readBillingReport.mockResolvedValue(
      ok(aPage([aBillingRow()], aBillingFigures())),
    );
    renderReport("billing");

    const table = within(await screen.findByRole("table"));
    expect(table.getByText("Synthetic Doctor")).toBeTruthy();
    expect(table.getByText("Consultant")).toBeTruthy();
    expect(table.getAllByRole("columnheader")).toHaveLength(9);
  });

  it("links pages with the period and doctor", async () => {
    readBillingReport.mockResolvedValue(
      ok(aPage([aBillingRow()], aBillingFigures(), 1, 2)),
    );
    renderReport("billing", {
      from: "2026-10-01",
      to: "2026-10-31",
      doctorId: null,
      isDefaultPeriod: false,
    });

    const next = await screen.findByRole("link", {
      name: messagesByLocale.en.shared.table.next,
    });
    expect(next.getAttribute("href")).toBe(
      "/reports/billing?from=2026-10-01&to=2026-10-31&page=2",
    );
  });

  it("replaces a page past the last with the last", async () => {
    readBillingReport.mockResolvedValue(
      ok({
        data: [],
        totals: aBillingFigures(),
        meta: {
          current_page: 5,
          last_page: 2,
          per_page: 15,
          total: 20,
          from: null,
          to: null,
        },
      }),
    );
    renderReport("billing", { page: 5 });

    await vi.waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/reports/billing?page=2"),
    );
    expect(screen.queryByText(t.billing.emptyTitle)).toBeNull();
  });

  it("shows the zero totals, then the empty state", async () => {
    readBillingReport.mockResolvedValue(
      ok(
        aPage(
          [],
          aBillingFigures({ active_charges: 0, uncharged_seen_visits: 0 }),
        ),
      ),
    );
    renderReport("billing");

    expect(await screen.findByText(t.billing.emptyTitle)).toBeTruthy();
    expect(screen.queryByText(t.needsAttention)).toBeNull();
  });
});
