import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readActivityReport,
  readBillingReport,
  readMoneyCollected,
  readTimesReport,
} from "./reports";

const { browserApi } = vi.hoisted(() => ({ browserApi: vi.fn() }));
vi.mock("@/lib/api/browser-api", () => ({ browserApi }));

const meta = {
  current_page: 1,
  last_page: 1,
  per_page: 15,
  total: 0,
  from: null,
  to: null,
};
const figures = { received: "0.00", refunded: "0.00", net: "0.00" };
const moneyCollected = {
  from: "2026-11-01",
  to: "2026-11-08",
  totals: figures,
  by_method: [],
  by_day: [],
};
const billing = {
  active_charges: 0,
  fees: "0.00",
  discounts: "0.00",
  amount_due: "0.00",
  amount_paid: "0.00",
  balance: "0.00",
  cancelled_charges: 0,
  uncharged_seen_visits: 0,
};
const activity = {
  appointments: {
    scheduled: 0,
    cancelled: 0,
    no_show: 0,
    checked_in: 0,
    completed: 0,
  },
  no_show_rate: null,
  visits: {
    waiting: 0,
    with_doctor: 0,
    seen: 0,
    left: 0,
    booked: 0,
    walk_in: 0,
  },
};
const times = {
  wait: { average_minutes: null, visits: 0 },
  consultation: { average_minutes: null, visits: 0 },
  records: { finalized: 0, draft: 0, none: 0 },
};
const answer = (data: unknown) => ({ ok: true, status: 200, data });
const PERIOD = { from: "2026-11-01", to: "2026-11-08", doctorId: null };

beforeEach(() => browserApi.mockReset());

describe("readMoneyCollected", () => {
  it("sends the period only, and gives the report itself", async () => {
    browserApi.mockResolvedValue(answer({ data: moneyCollected }));

    const result = await readMoneyCollected(PERIOD, "ar");

    expect(browserApi).toHaveBeenCalledWith(
      "reports/money-collected?from=2026-11-01&to=2026-11-08",
      { locale: "ar" },
    );
    expect(result.ok && result.data.totals.net).toBe("0.00");
  });

  it("sends a doctor when one is chosen", async () => {
    browserApi.mockResolvedValue(answer({ data: moneyCollected }));

    await readMoneyCollected({ ...PERIOD, doctorId: 3 }, "en");

    expect(browserApi).toHaveBeenCalledWith(
      "reports/money-collected?from=2026-11-01&to=2026-11-08&doctor_id=3",
      { locale: "en" },
    );
  });

  it("asks once for a refusal, which the API has decided", async () => {
    const refused = {
      ok: false,
      error: { status: 422, fieldErrors: { to: ["Refused."] } },
    };
    browserApi.mockResolvedValue(refused);

    expect(await readMoneyCollected(PERIOD, "en")).toEqual(refused);
    expect(browserApi).toHaveBeenCalledTimes(1);
  });

  it("treats a body that isn't the contract's as a failed read", async () => {
    browserApi.mockResolvedValue(
      answer({ data: { ...moneyCollected, totals: { ...figures, net: 0 } } }),
    );

    expect((await readMoneyCollected(PERIOD, "en")).ok).toBe(false);
  });
});

describe("paged reports", () => {
  it.each([
    ["billing", readBillingReport, billing],
    ["activity", readActivityReport, activity],
    ["times", readTimesReport, times],
  ] as const)(
    "%s sends the period, doctor, and page, and never a page size",
    async (name, read, totals) => {
      browserApi.mockResolvedValue(answer({ data: [], totals, meta }));

      const result = await read({ ...PERIOD, doctorId: 4, page: 2 }, "en");

      expect(browserApi).toHaveBeenCalledWith(
        `reports/${name}?from=2026-11-01&to=2026-11-08&doctor_id=4&page=2`,
        { locale: "en" },
      );
      expect(result.ok && result.data.totals).toEqual(totals);
    },
  );
});
