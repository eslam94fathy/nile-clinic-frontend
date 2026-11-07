import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { ok, pageOf, refused } from "../test-support";
import type { Visit } from "../types";
import { VisitList } from "./visit-list";

const api = vi.hoisted(() => ({
  readTodaysList: vi.fn(),
  startEncounter: vi.fn(),
}));
vi.mock("../api/encounters", () => api);
vi.mock("@/lib/i18n/navigation", async (original) => ({
  ...(await original<typeof import("@/lib/i18n/navigation")>()),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/my/visits",
}));
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/en/my/visits",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

const m = messagesByLocale.en;
const t = m.encounters;
const status = m.shared.status.record;

const visit = (
  id: number,
  recordStatus: Visit["record_status"],
  encounterId: number | null = null,
): Visit => ({
  id,
  date: "2026-11-01",
  walk_in: id % 2 === 0,
  arrived_at: "2026-11-01T08:00:00.000000Z",
  called_at: "2026-11-01T08:30:00.000000Z",
  finished_at: null,
  record_status: recordStatus,
  encounter_id: encounterId,
  patient: {
    id: id + 100,
    full_name: `Synthetic ${id}`,
    sex: "female",
    date_of_birth: "1990-01-01",
  },
});

const FILTERS = { from: "2026-10-08", to: "2026-11-07" };

function show(
  result: Parameters<typeof VisitList>[0]["result"] = ok(
    pageOf([
      visit(1, "none"),
      visit(2, "draft", 12),
      visit(3, "finalized", 13),
    ]),
  ),
) {
  renderWithIntl(
    <VisitList result={result} filters={FILTERS} timeZone="Africa/Cairo" />,
  );
}

/** The table keeps a copy for narrow screens, which this environment doesn't hide. */
const table = () => within(screen.getByRole("table"));

beforeEach(() => {
  api.readTodaysList.mockReset();
  api.readTodaysList.mockResolvedValue(ok({ data: [] }));
  api.startEncounter.mockReset();
});
afterEach(cleanup);

describe("VisitList", () => {
  it("keeps the API's order, and offers no sorting", () => {
    show();
    const rows = table().getAllByRole("row").slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Synthetic 1"),
      expect.stringContaining("Synthetic 2"),
      expect.stringContaining("Synthetic 3"),
    ]);
    expect(screen.queryByRole("button", { name: /sort/i })).toBeNull();
  });

  it("gives each row's status as text, its kind, and its times in the clinic's zone", () => {
    show();
    const rows = table().getAllByRole("row");
    expect(rows[1]?.textContent).toContain(status.none);
    expect(rows[1]?.textContent).toContain(t.visits.booked);
    expect(rows[2]?.textContent).toContain(status.draft);
    expect(rows[2]?.textContent).toContain(t.visits.walkIn);
    expect(rows[3]?.textContent).toContain(status.finalized);
    // 08:30 UTC is 10:30 in Cairo in November.
    expect(rows[1]?.textContent).toMatch(/10:30/);
  });

  it("offers the action matching each status, reading nothing", () => {
    show();
    expect(
      table().getByRole("button", { name: t.actions.start }),
    ).not.toBeNull();
    expect(
      table()
        .getByRole("link", { name: t.actions.continue })
        .getAttribute("href"),
    ).toBe("/en/my/encounters/12");
    expect(
      table().getByRole("link", { name: t.actions.open }).getAttribute("href"),
    ).toBe("/en/my/encounters/13");
    expect(api.startEncounter).not.toHaveBeenCalled();
  });

  it("offers a history only where the API is expected to allow it", async () => {
    api.readTodaysList.mockResolvedValue(
      ok({ data: [{ status: "waiting", patient: { id: 101 } }] }),
    );
    show();

    await waitFor(() => {
      const hrefs = table()
        .getAllByRole("link", { name: t.actions.history })
        .map((link) => link.getAttribute("href"));
      expect(hrefs).toEqual([
        "/en/my/patients/101/history",
        "/en/my/patients/103/history",
      ]);
    });
  });

  it("reads today's list once for the whole table", async () => {
    show();
    await waitFor(() => expect(api.readTodaysList).toHaveBeenCalledOnce());
  });

  it("offers only finalized rows' histories if today's list can't be read", async () => {
    api.readTodaysList.mockResolvedValue(refused(500));
    show();

    await waitFor(() => expect(api.readTodaysList).toHaveBeenCalledOnce());
    const hrefs = table()
      .getAllByRole("link", { name: t.actions.history })
      .map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(["/en/my/patients/103/history"]);
  });

  it("has a neutral empty state that keeps the filters", () => {
    show(ok(pageOf([])));
    expect(screen.getByText(t.visits.emptyTitle)).not.toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>(t.visits.from).value).toBe(
      FILTERS.from,
    );
  });

  it("shows a refused range on its field", () => {
    show(refused(422, { to: ["At most 92 days."] }));
    const to = screen.getByLabelText(t.visits.to);
    expect(to.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("At most 92 days.")).not.toBeNull();
  });

  it("shows a failed read's state", () => {
    show(refused(500, {}, "Went wrong."));
    expect(screen.getByText("Went wrong.")).not.toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
