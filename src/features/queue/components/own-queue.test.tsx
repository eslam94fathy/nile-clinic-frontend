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
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("@/lib/i18n/navigation", () => ({ useRouter: () => router }));
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

  it("gives sex and date of birth, with no links", async () => {
    api.readOwnQueue.mockResolvedValue(list(entry(2, "waiting")));
    setUp();

    // The table keeps a copy for narrow screens, which this environment doesn't hide.
    await screen.findAllByText("Synthetic 2");
    const table = screen.getByRole("table");
    expect(table.textContent).toContain(t.sex.female);
    expect(table.textContent).toContain("1990-04-12");
    expect(table.textContent).toContain("09:20");
    expect(screen.queryByRole("link")).toBeNull();
    expect(
      screen.getByRole("button", { name: t.own.callNext.action }),
    ).toBeTruthy();
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
