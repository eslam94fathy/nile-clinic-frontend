import { cleanup, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messagesByLocale } from "@/test-support/render-with-intl";
import { aActivityFigures, aActivityRow, aPage } from "../test-support";
import { ok, renderReport } from "./paged-reports.test-setup";

const readActivityReport = vi.hoisted(() => vi.fn());
vi.mock("../api/reports", () => ({ readActivityReport }));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/reports/activity",
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
const totalsSection = async (heading: string = t.allDoctors) =>
  within(
    (await screen.findByRole("heading", { name: heading })).closest(
      "section",
    ) ?? document.body,
  );

beforeEach(() => readActivityReport.mockReset());
afterEach(cleanup);

describe("ActivityReport", () => {
  it("shows every count and the rate as sent, with new patients", async () => {
    readActivityReport.mockResolvedValue(
      ok(
        aPage([aActivityRow()], {
          ...aActivityFigures({ no_show_rate: 12.5 }),
          new_patients: 4,
        }),
      ),
    );
    renderReport("activity");

    const totals = await totalsSection();
    expect(totals.getByText("12.5%")).toBeTruthy();
    expect(
      totals.getByText(t.activity.newPatients).nextSibling?.textContent,
    ).toBe("4");
    expect(
      totals.getByText("Appointments: No-show").nextSibling?.textContent,
    ).toBe("3");
    expect(totals.getByText("Visits: Walk-in").nextSibling?.textContent).toBe(
      "11",
    );
    expect(screen.getByText(t.activity.rateNote)).toBeTruthy();
  });

  it("says the rate isn't available, never zero, when the API sends none", async () => {
    readActivityReport.mockResolvedValue(
      ok(
        aPage([], {
          ...aActivityFigures({ no_show_rate: null }),
          new_patients: 0,
        }),
      ),
    );
    renderReport("activity");

    const totals = await totalsSection();
    expect(
      totals.getByText(t.activity.noShowRate).nextSibling?.textContent,
    ).toBe(t.notAvailable);
    // Zero new patients is a figure, and is shown as one.
    expect(
      totals.getByText(t.activity.newPatients).nextSibling?.textContent,
    ).toBe("0");
  });

  it("replaces new patients with a note when the API leaves it out", async () => {
    readActivityReport.mockResolvedValue(
      ok(aPage([aActivityRow()], aActivityFigures())),
    );
    renderReport("activity", { doctorId: 3 });

    const totals = await totalsSection(t.thisDoctor);
    expect(totals.queryByText(t.activity.newPatients)).toBeNull();
    expect(screen.getByText(t.activity.newPatientsForClinic)).toBeTruthy();
  });

  it("gives each doctor a row of 12 figures, after the doctor", async () => {
    readActivityReport.mockResolvedValue(
      ok(aPage([aActivityRow()], { ...aActivityFigures(), new_patients: 1 })),
    );
    renderReport("activity");

    const table = within(await screen.findByRole("table"));
    expect(table.getAllByRole("columnheader")).toHaveLength(13);
    expect(table.getByText("25.0%")).toBeTruthy();
  });

  it("shows the empty state with no appointments or visits", async () => {
    readActivityReport.mockResolvedValue(
      ok(aPage([], { ...aActivityFigures(), new_patients: 0 })),
    );
    renderReport("activity");

    expect(await screen.findByText(t.activity.emptyTitle)).toBeTruthy();
  });

  it("works in Arabic, with Western digits", async () => {
    readActivityReport.mockResolvedValue(
      ok(
        aPage([], {
          ...aActivityFigures({ no_show_rate: 12.5 }),
          new_patients: 0,
        }),
      ),
    );
    renderReport("activity", {}, "ar");

    const heading = await screen.findByRole("heading", {
      name: messagesByLocale.ar.reports.allDoctors,
    });
    expect(heading.closest("section")?.textContent).toContain("12.5");
  });
});
