import { cleanup, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messagesByLocale } from "@/test-support/render-with-intl";
import {
  anAppointmentRow,
  ok,
  refused,
  renderDashboard,
  TIME_ZONE,
  TODAY,
} from "../test-support";
import { ReceptionistDashboard } from "./receptionist-dashboard";

const api = vi.hoisted(() => ({
  readTodaysAppointments: vi.fn(),
  readQueueByStatus: vi.fn(),
  readMoneyOwed: vi.fn(),
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
const useLiveList = vi.hoisted(() => ({ policies: [] as unknown[] }));
vi.mock("@/lib/api/use-live-list", async (original) => {
  const actual = await original<typeof import("@/lib/api/use-live-list")>();
  return {
    useLiveList: (options: Parameters<typeof actual.useLiveList>[0]) => {
      useLiveList.policies.push(options.policy);
      return actual.useLiveList(options);
    },
  };
});

const d = messagesByLocale.en.dashboard;
const status = messagesByLocale.en.shared.status;

const panel = async (name: string) =>
  within(await screen.findByRole("region", { name }));
const figure = (scope: ReturnType<typeof within>, label: string) =>
  scope.getByText(label, { selector: "dt" }).nextSibling?.textContent;

function seed() {
  api.readTodaysAppointments.mockResolvedValue(
    ok({
      today: TODAY,
      toArrive: {
        rows: [1, 2, 3, 4, 5].map((id) => anAppointmentRow(id)),
        total: 8,
      },
      arrived: 4,
      completed: 2,
      noShow: 1,
    }),
  );
  api.readQueueByStatus.mockResolvedValue(
    ok({ waiting: 3, withDoctor: 1, seen: 6, left: 0 }),
  );
  api.readMoneyOwed.mockResolvedValue(
    ok({ today: TODAY, notCharged: 2, unpaid: 1, partlyPaid: 0 }),
  );
  api.readNeedingAMove.mockResolvedValue(
    ok({
      from: TODAY,
      to: "2027-02-09",
      list: { rows: [anAppointmentRow(9)], total: 1 },
    }),
  );
}

beforeEach(() => {
  Object.values(api).forEach((read) => read.mockReset());
  useLiveList.policies.length = 0;
  seed();
});
afterEach(cleanup);

describe("ReceptionistDashboard", () => {
  it("shows today's appointments by status, with the next five still to arrive", async () => {
    renderDashboard(
      <ReceptionistDashboard timeZone={TIME_ZONE} />,
      "receptionist",
    );
    const appointments = await panel(d.appointments.heading);

    expect(await appointments.findByText("Synthetic Patient 1")).toBeTruthy();
    expect(figure(appointments, d.appointments.toArrive)).toBe("8");
    expect(figure(appointments, d.appointments.arrived)).toBe("4");
    expect(figure(appointments, d.appointments.completed)).toBe("2");
    expect(figure(appointments, d.appointments.noShow)).toBe("1");

    const rows = appointments.getByRole("list", {
      name: d.appointments.listLabel,
    });
    expect(
      within(rows)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual([
      "/appointments/1",
      "/appointments/2",
      "/appointments/3",
      "/appointments/4",
      "/appointments/5",
    ]);
    expect(appointments.getByText("and 3 more")).toBeTruthy();
    expect(
      appointments
        .getByRole("link", { name: d.appointments.link })
        .getAttribute("href"),
    ).toBe("/appointments?status=scheduled");
    // Rows lead to the appointment, never the patient's record.
    expect(document.querySelector('a[href^="/patients"]')).toBeNull();
  });

  it("shows the queue by status, each leading to its filter", async () => {
    renderDashboard(
      <ReceptionistDashboard timeZone={TIME_ZONE} />,
      "receptionist",
    );
    const queue = await panel(d.queue.heading);

    expect(
      (
        await queue.findByRole("link", { name: `${status.queue.waiting}: 3` })
      ).getAttribute("href"),
    ).toBe("/queue?status=waiting");
    expect(
      queue
        .getByRole("link", { name: `${status.queue.with_doctor}: 1` })
        .getAttribute("href"),
    ).toBe("/queue?status=with_doctor");
    expect(
      queue.getByRole("link", { name: `${status.queue.left}: 0` }),
    ).toBeTruthy();
    expect(queue.queryByText(d.queue.empty)).toBeNull();
  });

  it("shows money owed with Billing's own words, each leading to its filter", async () => {
    renderDashboard(
      <ReceptionistDashboard timeZone={TIME_ZONE} />,
      "receptionist",
    );
    const owed = await panel(d.owed.heading);

    expect(
      (
        await owed.findByRole("link", { name: `${status.charge.none}: 2` })
      ).getAttribute("href"),
    ).toBe("/billing?charge_status=none");
    expect(
      owed
        .getByRole("link", { name: `${status.charge.unpaid}: 1` })
        .getAttribute("href"),
    ).toBe("/billing?charge_status=unpaid");
    expect(
      owed
        .getByRole("link", { name: `${status.charge.partially_paid}: 0` })
        .getAttribute("href"),
    ).toBe("/billing?charge_status=partially_paid");
  });

  it("shows appointments to move with their period and dates", async () => {
    renderDashboard(
      <ReceptionistDashboard timeZone={TIME_ZONE} />,
      "receptionist",
    );
    const move = await panel(d.move.heading);

    expect(await move.findByText("2027-02-09")).toBeTruthy();
    expect(figure(move, d.move.total)).toBe("1");
    expect(
      move
        .getByRole("link", { name: /Synthetic Patient 9/ })
        .getAttribute("href"),
    ).toBe("/appointments/9");
    expect(
      move.getByRole("link", { name: d.move.link }).getAttribute("href"),
    ).toBe("/appointments?outside_availability=1");
  });

  it("says so in words when there is nothing, with zeros as figures", async () => {
    api.readTodaysAppointments.mockResolvedValue(
      ok({
        today: TODAY,
        toArrive: { rows: [], total: 0 },
        arrived: 0,
        completed: 0,
        noShow: 0,
      }),
    );
    api.readQueueByStatus.mockResolvedValue(
      ok({ waiting: 0, withDoctor: 0, seen: 0, left: 0 }),
    );
    api.readMoneyOwed.mockResolvedValue(
      ok({ today: TODAY, notCharged: 0, unpaid: 0, partlyPaid: 0 }),
    );
    api.readNeedingAMove.mockResolvedValue(
      ok({ from: TODAY, to: "2027-02-09", list: { rows: [], total: 0 } }),
    );
    renderDashboard(
      <ReceptionistDashboard timeZone={TIME_ZONE} />,
      "receptionist",
    );

    expect(await screen.findByText(d.appointments.empty)).toBeTruthy();
    expect(await screen.findByText(d.queue.empty)).toBeTruthy();
    expect(await screen.findByText(d.owed.empty)).toBeTruthy();
    expect(await screen.findByText(d.move.empty)).toBeTruthy();
    expect(
      figure(await panel(d.appointments.heading), d.appointments.toArrive),
    ).toBe("0");
  });

  it("keeps one panel's failure inside it", async () => {
    api.readQueueByStatus.mockResolvedValue(
      refused(500, "The queue couldn't be read."),
    );
    renderDashboard(
      <ReceptionistDashboard timeZone={TIME_ZONE} />,
      "receptionist",
    );

    expect(
      await (
        await panel(d.queue.heading)
      ).findByText("The queue couldn't be read."),
    ).toBeTruthy();
    expect(figure(await panel(d.owed.heading), status.charge.unpaid)).toBe("1");
  });

  it("reads every panel live", async () => {
    renderDashboard(
      <ReceptionistDashboard timeZone={TIME_ZONE} />,
      "receptionist",
    );
    await screen.findByText("Synthetic Patient 1");
    expect(
      useLiveList.policies.every(
        (policy) =>
          (policy as { refetchInterval: unknown }).refetchInterval === 15_000,
      ),
    ).toBe(true);
  });

  it("shows nothing a role can't use, as the UI's permissions say", async () => {
    renderDashboard(<ReceptionistDashboard timeZone={TIME_ZONE} />, "doctor");
    await Promise.resolve();
    expect(screen.queryAllByRole("region")).toHaveLength(0);
    expect(api.readQueueByStatus).not.toHaveBeenCalled();
  });
});
