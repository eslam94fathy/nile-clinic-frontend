import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messagesByLocale } from "@/test-support/render-with-intl";
import type { QueueEntry, QueueFilters } from "../types";
import { ClinicQueue } from "./clinic-queue";

const api = vi.hoisted(() => ({
  readClinicQueue: vi.fn(),
  readDoctorQueue: vi.fn(),
  markLeft: vi.fn(),
  undoCheckIn: vi.fn(),
}));
vi.mock("../api/queue", () => api);

const router = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
  usePathname: () => "/queue",
  useRouter: () => router,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/patients/public", () => ({
  PatientLink: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const t = messagesByLocale.en.queue;
const { states } = messagesByLocale.en.shared;

function entry(id: number, changes: Partial<QueueEntry> = {}): QueueEntry {
  return {
    id,
    queue_number: id,
    status: "waiting",
    walk_in: true,
    arrived_at: "2026-11-07T08:00:00.000000Z",
    called_at: null,
    finished_at: null,
    left_at: null,
    appointment: null,
    doctor: { id: 3, name: "Synthetic Doctor", title: "Consultant" },
    patient: {
      id: id + 100,
      full_name: `Synthetic ${id}`,
      phone: "01000000001",
    },
    ...changes,
  };
}

const meta = (changes = {}) => ({
  current_page: 1,
  last_page: 1,
  per_page: 100,
  total: 1,
  from: 1,
  to: 1,
  ...changes,
});
const page = (rows: QueueEntry[], changes = {}) => ({
  ok: true,
  status: 200,
  data: { data: rows, meta: meta(changes) },
});

beforeEach(() => {
  for (const mock of Object.values(api)) mock.mockReset();
  router.replace.mockReset();
});
afterEach(cleanup);

function setUp(filters: Partial<QueueFilters> = {}) {
  render(
    <NextIntlClientProvider
      locale="en"
      messages={messagesByLocale.en}
      timeZone="Africa/Cairo"
    >
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retryDelay: 1 } },
          })
        }
      >
        <ClinicQueue
          filters={{ doctorId: null, status: null, page: 1, ...filters }}
          doctors={[{ id: 3, name: "Synthetic Doctor", is_active: true }]}
          timeZone="Africa/Cairo"
        />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe("ClinicQueue", () => {
  it("reads the whole clinic with no filters, and groups by doctor", async () => {
    api.readClinicQueue.mockResolvedValue(
      page([
        entry(1),
        entry(2, {
          doctor: { id: 4, name: "Second Doctor", title: "Consultant" },
        }),
      ]),
    );
    setUp();

    await screen.findByRole("heading", {
      level: 3,
      name: /Second Doctor/,
    });
    expect(api.readClinicQueue).toHaveBeenCalledWith(
      { status: null, page: 1 },
      "en",
    );
    expect(screen.getAllByRole("table")).toHaveLength(2);
    expect(api.readDoctorQueue).not.toHaveBeenCalled();
  });

  it("sends the status for the whole clinic, as the API can filter it", async () => {
    api.readClinicQueue.mockResolvedValue(page([entry(1)]));
    setUp({ status: "waiting", page: 2 });

    await waitFor(() =>
      expect(api.readClinicQueue).toHaveBeenCalledWith(
        { status: "waiting", page: 2 },
        "en",
      ),
    );
  });

  it("narrows a chosen doctor's complete list by status on screen, keeping the order", async () => {
    api.readDoctorQueue.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        data: [entry(9), entry(2, { status: "seen" }), entry(5)],
      },
    });
    setUp({ doctorId: 3, status: "waiting" });

    // The table keeps a copy for narrow screens, which this environment doesn't hide.
    await screen.findAllByText("Synthetic 9");
    expect(api.readDoctorQueue).toHaveBeenCalledWith(3, "en");
    expect(screen.queryByText("Synthetic 2")).toBeNull();
    const rows = screen.getAllByRole("row").map((row) => row.textContent);
    expect(
      rows.findIndex((text) => text?.includes("Synthetic 9")),
    ).toBeLessThan(rows.findIndex((text) => text?.includes("Synthetic 5")));
  });

  it("says nobody has arrived, and offers the way forward", async () => {
    api.readClinicQueue.mockResolvedValue(page([], { total: 0 }));
    setUp();

    await screen.findByText(t.empty.todayTitle);
    expect(
      screen.getByRole("link", { name: t.addWalkIn }).getAttribute("href"),
    ).toBe("/queue/walk-in");
  });

  it("says nobody matches when filtered", async () => {
    api.readClinicQueue.mockResolvedValue(page([], { total: 0 }));
    setUp({ status: "left" });

    await screen.findByText(t.empty.filteredTitle);
  });

  it("goes to the last page there is, rather than saying nobody is here", async () => {
    api.readClinicQueue.mockResolvedValue(
      page([], { current_page: 5, last_page: 2, total: 150 }),
    );
    setUp({ page: 5 });

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/queue?page=2"),
    );
    expect(screen.queryByText(t.empty.todayTitle)).toBeNull();
  });

  it("shows only the refusal on a 403, with no filters or patients", async () => {
    api.readClinicQueue.mockResolvedValue({
      ok: false,
      error: { status: 403, fieldErrors: {} },
    });
    setUp();

    await screen.findByText(states.forbiddenHeading);
    expect(screen.queryByRole("form")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("is neutrally not found for a doctor who doesn't exist, with a way back", async () => {
    api.readDoctorQueue.mockResolvedValue({
      ok: false,
      error: { status: 404, fieldErrors: {} },
    });
    setUp({ doctorId: 999 });

    await screen.findByText(states.notFoundHeading);
    expect(
      screen.getByRole("link", { name: t.allDoctors }).getAttribute("href"),
    ).toBe("/queue");
  });

  it("offers to try again when the first read fails", async () => {
    api.readClinicQueue.mockResolvedValue({
      ok: false,
      error: { status: 500, fieldErrors: {} },
    });
    setUp();

    await screen.findByText(t.readFailed);
    expect(screen.getByRole("button", { name: states.retry })).toBeTruthy();
  });

  it("offers inactive doctors in the filter, marked so", async () => {
    api.readClinicQueue.mockResolvedValue(page([entry(1)]));
    render(
      <NextIntlClientProvider
        locale="en"
        messages={messagesByLocale.en}
        timeZone="Africa/Cairo"
      >
        <QueryClientProvider client={new QueryClient()}>
          <ClinicQueue
            filters={{ doctorId: null, status: null, page: 1 }}
            doctors={[{ id: 3, name: "Synthetic Gone", is_active: false }]}
            timeZone="Africa/Cairo"
          />
        </QueryClientProvider>
      </NextIntlClientProvider>,
    );

    await screen.findByRole("option", {
      name: t.filters.inactiveDoctor.replace("{name}", "Synthetic Gone"),
    });
  });
});
