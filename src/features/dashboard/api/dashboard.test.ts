import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiResult } from "@/lib/api/api-error";
import {
  readActivityToday,
  readMoneyOwed,
  readMoneyToday,
  readNeedingAMove,
  readNextOwnAppointments,
  readOwnQueue,
  readOwnRecords,
  readQueueByStatus,
  readTodaysAppointments,
} from "./dashboard";

const browserApi = vi.hoisted(() =>
  vi.fn<
    (
      path: string,
      options: { locale: string; method?: string },
    ) => Promise<ApiResult<unknown>>
  >(),
);
vi.mock("@/lib/api/browser-api", () => ({ browserApi }));

const TODAY = "2026-11-11";

// Synthetic values only.
const page = (total: number, data: unknown[] = []) => ({
  ok: true as const,
  status: 200,
  data: {
    data,
    meta: {
      total,
      current_page: 1,
      last_page: 1,
      per_page: 1,
      from: null,
      to: null,
    },
  },
});
const refused = (status: number) => ({
  ok: false as const,
  error: { status, fieldErrors: {} },
});
const anAppointment = (id: number) => ({
  id,
  date: TODAY,
  start: "09:00",
  end: "09:20",
  status: "scheduled",
  outside_availability: false,
  doctor: { id: 3, name: "Synthetic Doctor", title: "Consultant" },
  patient: { id: 12, full_name: "Synthetic Patient", phone: "01000000000" },
});

const requested = () => browserApi.mock.calls.map(([path]) => path);

/** The query of one request, as sorted pairs, so the order parameters are written in doesn't matter. */
const queryOf = (path: string) =>
  Object.fromEntries(new URL(path, "http://x/").searchParams.entries());

beforeEach(() => {
  browserApi.mockReset();
  browserApi.mockResolvedValue(page(0));
});

describe("receptionist reads", () => {
  it("counts today's appointments by status, with five still to arrive", async () => {
    browserApi.mockImplementation((path) =>
      Promise.resolve(
        path.includes("status=scheduled")
          ? page(7, [anAppointment(1), anAppointment(2)])
          : page(
              path.includes("checked_in")
                ? 3
                : path.includes("completed")
                  ? 2
                  : 1,
            ),
      ),
    );
    const result = await readTodaysAppointments(TODAY, "en");

    expect(result).toEqual({
      ok: true,
      status: 200,
      data: {
        today: TODAY,
        toArrive: {
          total: 7,
          rows: [1, 2].map((id) => ({
            id,
            date: TODAY,
            start: "09:00",
            end: "09:20",
            patient: { full_name: "Synthetic Patient" },
            doctor: { name: "Synthetic Doctor", title: "Consultant" },
          })),
        },
        arrived: 3,
        completed: 2,
        noShow: 1,
      },
    });
    expect(requested().map(queryOf)).toEqual([
      { from: TODAY, to: TODAY, status: "scheduled", per_page: "5" },
      { from: TODAY, to: TODAY, status: "checked_in", per_page: "1" },
      { from: TODAY, to: TODAY, status: "completed", per_page: "1" },
      { from: TODAY, to: TODAY, status: "no_show", per_page: "1" },
    ]);
    expect(requested().every((path) => path.startsWith("appointments?"))).toBe(
      true,
    );
  });

  it("counts the queue by each status, with no date", async () => {
    await readQueueByStatus("en");
    expect(requested()).toEqual([
      "queue?status=waiting&per_page=1",
      "queue?status=with_doctor&per_page=1",
      "queue?status=seen&per_page=1",
      "queue?status=left&per_page=1",
    ]);
  });

  it("counts today's visits not charged, unpaid, and partly paid", async () => {
    await readMoneyOwed(TODAY, "ar");
    expect(requested()).toEqual([
      `visits?date=${TODAY}&charge_status=none&per_page=1`,
      `visits?date=${TODAY}&charge_status=unpaid&per_page=1`,
      `visits?date=${TODAY}&charge_status=partially_paid&per_page=1`,
    ]);
    expect(
      browserApi.mock.calls.every(([, options]) => options.locale === "ar"),
    ).toBe(true);
  });

  it("reads appointments to move from today to 90 days ahead, as the Appointments screen does", async () => {
    browserApi.mockResolvedValue(page(9, [anAppointment(5)]));
    const result = await readNeedingAMove(TODAY, "en");

    expect(requested().map(queryOf)).toEqual([
      {
        from: TODAY,
        to: "2027-02-09",
        outside_availability: "1",
        per_page: "5",
      },
    ]);
    expect(result.ok && result.data).toMatchObject({
      from: TODAY,
      to: "2027-02-09",
      list: { total: 9 },
    });
  });
});

describe("doctor reads", () => {
  const entry = (id: number, status: string) => ({
    id,
    queue_number: id,
    status,
    walk_in: false,
    arrived_at: "2026-11-11T07:00:00.000000Z",
    called_at: status === "with_doctor" ? "2026-11-11T07:30:00.000000Z" : null,
    finished_at: null,
    left_at: null,
    appointment: null,
    patient: {
      id,
      full_name: `Synthetic Patient ${id}`,
      sex: "male",
      date_of_birth: "1990-01-01",
    },
  });

  it("finds who is with the doctor, and everyone waiting in the API's order", async () => {
    browserApi.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        data: [
          entry(1, "seen"),
          entry(2, "with_doctor"),
          entry(4, "waiting"),
          entry(3, "waiting"),
          entry(5, "left"),
        ],
      },
    });
    const result = await readOwnQueue("en");

    expect(requested()).toEqual(["doctors/me/queue"]);
    expect(result.ok && result.data.current?.id).toBe(2);
    expect(result.ok && result.data.waiting.map(({ id }) => id)).toEqual([
      4, 3,
    ]);
  });

  it("reads the next five of today's appointments still to arrive", async () => {
    await readNextOwnAppointments(TODAY, "en");
    expect(requested().map(queryOf)).toEqual([
      { from: TODAY, to: TODAY, status: "scheduled", per_page: "5" },
    ]);
    expect(requested()[0]).toMatch(/^doctors\/me\/appointments\?/);
  });

  it("counts visits with no record and with a draft over 92 days, ending today", async () => {
    browserApi.mockImplementation((path) =>
      Promise.resolve(page(path.includes("draft") ? 2 : 5)),
    );
    const result = await readOwnRecords(TODAY, "en");

    expect(requested()).toEqual([
      `doctors/me/visits?from=2026-08-12&to=${TODAY}&record_status=none&per_page=1`,
      `doctors/me/visits?from=2026-08-12&to=${TODAY}&record_status=draft&per_page=1`,
    ]);
    expect(result.ok && result.data).toEqual({
      from: "2026-08-12",
      to: TODAY,
      none: 5,
      draft: 2,
    });
  });
});

describe("administrator reads", () => {
  it("reads today's money collected, keeping amounts as sent", async () => {
    const totals = { received: "1200.50", refunded: "0.00", net: "1200.50" };
    browserApi.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        data: { from: TODAY, to: TODAY, totals, by_method: [], by_day: [] },
      },
    });
    const result = await readMoneyToday(TODAY, "en");

    expect(requested()).toEqual([
      `reports/money-collected?from=${TODAY}&to=${TODAY}`,
    ]);
    expect(result.ok && result.data.money.totals).toEqual(totals);
  });

  it("reads today's activity totals", async () => {
    await readActivityToday(TODAY, "en");
    expect(requested()).toEqual([`reports/activity?from=${TODAY}&to=${TODAY}`]);
  });
});

describe("a panel's several requests", () => {
  it("fail as one when any fails, and nothing is shown from the others", async () => {
    browserApi.mockImplementation((path) =>
      Promise.resolve(path.includes("seen") ? refused(500) : page(3)),
    );
    expect(await readQueueByStatus("en")).toEqual({
      ok: false,
      error: { status: 500, fieldErrors: {} },
    });
  });

  it("show a refusal before a server error", async () => {
    browserApi.mockImplementation((path) =>
      Promise.resolve(path.includes("unpaid") ? refused(500) : refused(403)),
    );
    const result = await readMoneyOwed(TODAY, "en");
    expect(!result.ok && result.error.status).toBe(403);
  });

  it("treat a body that isn't the expected shape as a failed read", async () => {
    browserApi.mockResolvedValue({ ok: true, status: 200, data: { data: [] } });
    const result = await readQueueByStatus("en");
    expect(!result.ok && result.error.status).toBe(0);
  });
});

describe("what is never requested", () => {
  it("has no audited path and no change, anywhere in the module", () => {
    const source = readFileSync(
      join(process.cwd(), "src/features/dashboard/api/dashboard.ts"),
      "utf8",
    );
    // Comments name these on purpose, to warn; only code is checked.
    const code = source
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");

    expect(code).not.toMatch(/["`]patients\//);
    expect(code).not.toMatch(/encounters/);
    expect(code).not.toMatch(/audit-entries/);
    expect(code).not.toMatch(/method:/);
  });

  it("only ever makes reads, with no method other than the default", async () => {
    await Promise.all([
      readTodaysAppointments(TODAY, "en"),
      readQueueByStatus("en"),
      readMoneyOwed(TODAY, "en"),
      readNeedingAMove(TODAY, "en"),
      readNextOwnAppointments(TODAY, "en"),
      readOwnRecords(TODAY, "en"),
      readMoneyToday(TODAY, "en"),
      readActivityToday(TODAY, "en"),
    ]);
    browserApi.mockResolvedValue({ ok: true, status: 200, data: { data: [] } });
    await readOwnQueue("en");

    expect(
      browserApi.mock.calls.every(
        ([, options]) => options.method === undefined,
      ),
    ).toBe(true);
    for (const path of requested()) {
      expect(path).not.toMatch(
        /^(patients\/|doctors\/me\/encounters|doctors\/me\/patients|audit-entries)/,
      );
    }
    // Rows 1–18 of contracts/api-usage.md, each once.
    expect(requested()).toHaveLength(18);
  });
});
