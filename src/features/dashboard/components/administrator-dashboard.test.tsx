import { cleanup, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messagesByLocale } from "@/test-support/render-with-intl";
import {
  anAppointmentRow,
  ok,
  renderDashboard,
  TIME_ZONE,
  TODAY,
} from "../test-support";
import { AdministratorDashboard } from "./administrator-dashboard";

const api = vi.hoisted(() => ({
  readMoneyToday: vi.fn(),
  readActivityToday: vi.fn(),
  readNeedingAMove: vi.fn(),
}));
vi.mock("../api/dashboard", () => api);
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
}));
const policies = vi.hoisted(() => [] as unknown[]);
vi.mock("@/lib/api/use-live-list", async (original) => {
  const actual = await original<typeof import("@/lib/api/use-live-list")>();
  return {
    useLiveList: (options: Parameters<typeof actual.useLiveList>[0]) => {
      policies.push(options.policy);
      return actual.useLiveList(options);
    },
  };
});

const { dashboard: d, reports: r, shared } = messagesByLocale.en;
const panel = async (name: string) =>
  within(await screen.findByRole("region", { name }));
/** `Intl` puts a no-break space inside an amount. */
const plain = (text: string | null | undefined) =>
  (text ?? "").replace(/\s/g, " ");
const value = (scope: ReturnType<typeof within>, label: string) =>
  plain(scope.getByText(label, { selector: "dt" }).nextSibling?.textContent);

const totals = {
  appointments: {
    scheduled: 5,
    cancelled: 1,
    no_show: 2,
    checked_in: 3,
    completed: 4,
  },
  no_show_rate: 22.2,
  visits: {
    waiting: 2,
    with_doctor: 1,
    seen: 6,
    left: 1,
    booked: 7,
    walk_in: 3,
  },
  new_patients: 2,
};

beforeEach(() => {
  Object.values(api).forEach((read) => read.mockReset());
  policies.length = 0;
  api.readMoneyToday.mockResolvedValue(
    ok({
      today: TODAY,
      money: {
        totals: { received: "1250.50", refunded: "100.00", net: "1150.50" },
        by_method: [
          {
            method: "cash",
            received: "1000.50",
            refunded: "100.00",
            net: "900.50",
          },
          {
            method: "voucher",
            received: "250.00",
            refunded: "0.00",
            net: "250.00",
          },
        ],
      },
    }),
  );
  api.readActivityToday.mockResolvedValue(ok({ today: TODAY, totals }));
  api.readNeedingAMove.mockResolvedValue(
    ok({
      from: TODAY,
      to: "2027-02-09",
      list: { rows: [anAppointmentRow(9)], total: 1 },
    }),
  );
});
afterEach(cleanup);

describe("AdministratorDashboard", () => {
  it("shows today's money exactly as sent, by method, with an unknown method as sent", async () => {
    renderDashboard(
      <AdministratorDashboard timeZone={TIME_ZONE} today={TODAY} />,
      "administrator",
    );
    const money = await panel(d.money.heading);

    await money.findByText(shared.paymentMethod.cash);
    expect(value(money, r.money.received)).toContain("1,250.50");
    expect(value(money, r.money.refunded)).toContain("100.00");
    expect(value(money, r.money.net)).toContain("1,150.50");
    expect(value(money, shared.paymentMethod.cash)).toContain("1,000.50");
    expect(value(money, "voucher")).toContain("250.00");
    expect(
      money.getByRole("link", { name: d.money.link }).getAttribute("href"),
    ).toBe(`/reports/money-collected?from=${TODAY}&to=${TODAY}`);
  });

  it("shows a negative net as sent, and says so in words", async () => {
    api.readMoneyToday.mockResolvedValue(
      ok({
        today: TODAY,
        money: {
          totals: { received: "0.00", refunded: "50.00", net: "-50.00" },
          by_method: [
            {
              method: "card",
              received: "0.00",
              refunded: "50.00",
              net: "-50.00",
            },
          ],
        },
      }),
    );
    renderDashboard(
      <AdministratorDashboard timeZone={TIME_ZONE} today={TODAY} />,
      "administrator",
    );
    const money = await panel(d.money.heading);

    await money.findByText(shared.paymentMethod.card);
    expect(value(money, r.money.net)).toContain("50.00");
    expect(value(money, r.money.net)).toContain(r.negative);
  });

  it("says no money was recorded on a day with none", async () => {
    api.readMoneyToday.mockResolvedValue(
      ok({
        today: TODAY,
        money: {
          totals: { received: "0.00", refunded: "0.00", net: "0.00" },
          by_method: [],
        },
      }),
    );
    renderDashboard(
      <AdministratorDashboard timeZone={TIME_ZONE} today={TODAY} />,
      "administrator",
    );
    expect(await screen.findByText(d.money.empty)).toBeTruthy();
  });

  it("shows today's activity, with the rate as sent", async () => {
    renderDashboard(
      <AdministratorDashboard timeZone={TIME_ZONE} today={TODAY} />,
      "administrator",
    );
    const activity = await panel(d.activity.heading);

    await activity.findByText(r.activity.noShowRate);
    expect(value(activity, shared.status.appointment.cancelled)).toBe("1");
    expect(value(activity, shared.status.queue.with_doctor)).toBe("1");
    expect(value(activity, r.activity.walkIn)).toBe("3");
    expect(value(activity, r.activity.newPatients)).toBe("2");
    expect(value(activity, r.activity.noShowRate)).toBe("22.2%");
    expect(
      activity
        .getByRole("link", { name: d.activity.link })
        .getAttribute("href"),
    ).toBe(`/reports/activity?from=${TODAY}&to=${TODAY}`);
  });

  it("says the rate isn't available, never zero, when the API sends none", async () => {
    api.readActivityToday.mockResolvedValue(
      ok({ today: TODAY, totals: { ...totals, no_show_rate: null } }),
    );
    renderDashboard(
      <AdministratorDashboard timeZone={TIME_ZONE} today={TODAY} />,
      "administrator",
    );
    const activity = await panel(d.activity.heading);

    await activity.findByText(r.activity.noShowRate);
    expect(value(activity, r.activity.noShowRate)).toBe(r.notAvailable);
  });

  it("has appointments to move, and none of the desk's panels", async () => {
    renderDashboard(
      <AdministratorDashboard timeZone={TIME_ZONE} today={TODAY} />,
      "administrator",
    );

    expect(await panel(d.move.heading)).toBeTruthy();
    expect(screen.queryByRole("region", { name: d.queue.heading })).toBeNull();
    expect(screen.queryByRole("region", { name: d.owed.heading })).toBeNull();
    expect(
      screen.queryByRole("region", { name: d.appointments.heading }),
    ).toBeNull();
  });

  it("never reads by itself", async () => {
    renderDashboard(
      <AdministratorDashboard timeZone={TIME_ZONE} today={TODAY} />,
      "administrator",
    );
    await panel(d.money.heading);
    expect(policies.length).toBeGreaterThan(0);
    expect(
      policies.every(
        (policy) =>
          (policy as { refetchInterval: unknown }).refetchInterval === false,
      ),
    ).toBe(true);
    // Each of the three panels says when it was read, and offers Refresh.
    await waitFor(() =>
      expect(screen.getAllByText(shared.lastRead.label)).toHaveLength(3),
    );
  });
});
