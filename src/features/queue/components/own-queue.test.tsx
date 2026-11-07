import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messagesByLocale } from "@/test-support/render-with-intl";
import type { OwnQueueEntry } from "../types";
import { OwnQueue } from "./own-queue";

const api = vi.hoisted(() => ({
  readOwnQueue: vi.fn(),
  callNext: vi.fn(),
  finishVisit: vi.fn(),
}));
vi.mock("../api/queue", () => api);
const encounters = vi.hoisted(() => ({
  readTodaysVisits: vi.fn(),
  startEncounter: vi.fn(),
}));
vi.mock("@/features/encounters/api/encounters", () => encounters);
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("@/lib/i18n/navigation", async (original) => ({
  ...(await original<typeof import("@/lib/i18n/navigation")>()),
  useRouter: () => router,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const t = messagesByLocale.en.queue;
const { states } = messagesByLocale.en.shared;

function entry(id: number, status: OwnQueueEntry["status"]): OwnQueueEntry {
  return {
    id,
    queue_number: id,
    status,
    walk_in: false,
    arrived_at: "2026-11-07T08:00:00.000000Z",
    called_at: null,
    finished_at: null,
    left_at: null,
    appointment: { id: 7, start: "09:20", end: "09:40" },
    patient: {
      id: id + 100,
      full_name: `Synthetic ${id}`,
      sex: "female",
      date_of_birth: "1990-04-12",
    },
  };
}

const list = (...entries: OwnQueueEntry[]) => ({
  ok: true,
  status: 200,
  data: { data: entries },
});

beforeEach(() => {
  api.readOwnQueue.mockReset();
  encounters.readTodaysVisits.mockReset();
  encounters.readTodaysVisits.mockResolvedValue({
    ok: true,
    status: 200,
    data: { data: [] },
  });
  router.refresh.mockReset();
});
afterEach(cleanup);

function setUp() {
  render(
    <NextIntlClientProvider
      locale="en"
      messages={messagesByLocale.en}
      timeZone="Africa/Cairo"
    >
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retryDelay: 1 } } })
        }
      >
        <OwnQueue timeZone="Africa/Cairo" />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe("OwnQueue", () => {
  it("sets the current patient apart, and doesn't also list them", async () => {
    api.readOwnQueue.mockResolvedValue(
      list(entry(1, "with_doctor"), entry(2, "waiting")),
    );
    setUp();

    const current = await screen.findByRole("region", {
      name: t.own.currentHeading,
    });
    expect(current.textContent).toContain("Synthetic 1");
    expect(screen.getByRole("table").textContent).not.toContain("Synthetic 1");
    expect(screen.getByRole("table").textContent).toContain("Synthetic 2");
    expect(
      screen.getByRole("button", { name: t.own.finish.action }),
    ).toBeTruthy();
  });

  it("gives sex and date of birth, with no link to a patient's record", async () => {
    api.readOwnQueue.mockResolvedValue(list(entry(2, "waiting")));
    setUp();

    // The table keeps a copy for narrow screens, which this environment doesn't hide.
    await screen.findAllByText("Synthetic 2");
    const table = screen.getByRole("table");
    expect(table.textContent).toContain(t.sex.female);
    expect(table.textContent).toContain("1990-04-12");
    expect(table.textContent).toContain("09:20");
    for (const link of screen.queryAllByRole("link")) {
      expect(link.getAttribute("href")).toMatch(
        /\/my\/patients\/\d+\/history$/,
      );
    }
    expect(
      screen.getByRole("button", { name: t.own.callNext.action }),
    ).toBeTruthy();
  });

  describe("records", () => {
    const e = messagesByLocale.en.encounters;
    const record = messagesByLocale.en.shared.status.record;
    const visit = (
      id: number,
      recordStatus: "none" | "draft" | "finalized",
      encounterId: number | null = null,
    ) => ({
      id,
      date: "2026-11-07",
      walk_in: false,
      arrived_at: "2026-11-07T08:00:00.000000Z",
      called_at: null,
      finished_at: null,
      record_status: recordStatus,
      encounter_id: encounterId,
      patient: {
        id: id + 100,
        full_name: `Synthetic ${id}`,
        sex: "female",
        date_of_birth: "1990-04-12",
      },
    });
    const visits = (...rows: ReturnType<typeof visit>[]) =>
      encounters.readTodaysVisits.mockResolvedValue({
        ok: true,
        status: 200,
        data: { data: rows },
      });

    it("offers starting a record for the current patient, in one action", async () => {
      api.readOwnQueue.mockResolvedValue(list(entry(1, "with_doctor")));
      visits(visit(1, "none"));
      setUp();

      const current = await screen.findByRole("region", {
        name: t.own.currentHeading,
      });
      await waitFor(() => {
        expect(current.textContent).toContain(record.none);
      });
      expect(current.textContent).toContain(e.actions.start);
      expect(encounters.startEncounter).not.toHaveBeenCalled();
    });

    it("links to a draft or a finalized record, reading neither", async () => {
      api.readOwnQueue.mockResolvedValue(
        list(entry(1, "with_doctor"), entry(2, "seen")),
      );
      visits(visit(1, "draft", 11), visit(2, "finalized", 12));
      setUp();

      const continuing = await screen.findByRole("link", {
        name: e.actions.continue,
      });
      expect(continuing.getAttribute("href")).toContain("/my/encounters/11");
      const opening = screen.getAllByRole("link", { name: e.actions.open })[0];
      expect(opening?.getAttribute("href")).toContain("/my/encounters/12");
    });

    it("shows no status and no action for a visit with no match", async () => {
      api.readOwnQueue.mockResolvedValue(list(entry(1, "with_doctor")));
      setUp();

      await screen.findByRole("region", { name: t.own.currentHeading });
      await waitFor(() => {
        expect(encounters.readTodaysVisits).toHaveBeenCalled();
      });
      expect(
        screen.queryByRole("button", { name: e.actions.start }),
      ).toBeNull();
      expect(screen.queryByText(record.none)).toBeNull();
    });

    it("keeps the queue working when statuses can't be read", async () => {
      api.readOwnQueue.mockResolvedValue(list(entry(1, "with_doctor")));
      encounters.readTodaysVisits.mockResolvedValue({
        ok: false,
        error: { status: 500, fieldErrors: {} },
      });
      setUp();

      await screen.findByText(t.own.recordsUnavailable);
      expect(
        screen.getByRole("button", { name: t.own.finish.action }),
      ).toBeTruthy();
    });

    it("offers a history to anyone but those who left", async () => {
      api.readOwnQueue.mockResolvedValue(
        list(entry(1, "waiting"), entry(2, "left")),
      );
      setUp();

      await screen.findAllByText("Synthetic 2");
      const hrefs = screen
        .getAllByRole("link", { name: e.actions.history })
        .map((link) => link.getAttribute("href"));
      expect(new Set(hrefs)).toEqual(new Set(["/en/my/patients/101/history"]));
    });
  });

  it("says nobody has arrived", async () => {
    api.readOwnQueue.mockResolvedValue(list());
    setUp();

    await screen.findByText(t.own.emptyTitle);
    expect(
      screen.queryByRole("button", { name: t.own.callNext.action }),
    ).toBeNull();
  });

  it("says nobody is waiting once everyone is seen, and keeps their rows", async () => {
    api.readOwnQueue.mockResolvedValue(list(entry(1, "seen")));
    setUp();

    await screen.findByText(t.own.nobodyWaiting);
    expect(screen.getByRole("table").textContent).toContain("Synthetic 1");
  });

  it("offers to try again when the first read fails", async () => {
    api.readOwnQueue.mockResolvedValue({
      ok: false,
      error: { status: 500, fieldErrors: {} },
    });
    setUp();

    await screen.findByText(t.readFailed);
    expect(screen.getByRole("button", { name: states.retry })).toBeTruthy();
  });

  it("leaves a missing profile to the gate, by refreshing the page", async () => {
    api.readOwnQueue.mockResolvedValue({
      ok: false,
      error: { status: 404, fieldErrors: {} },
    });
    setUp();

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
  });

  it("shows only the refusal on a 403", async () => {
    api.readOwnQueue.mockResolvedValue({
      ok: false,
      error: { status: 403, fieldErrors: {} },
    });
    setUp();

    await screen.findByText(states.forbiddenHeading);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
