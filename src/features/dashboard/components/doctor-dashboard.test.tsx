import { cleanup, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messagesByLocale } from "@/test-support/render-with-intl";
import {
  ok,
  refused,
  renderDashboard,
  TIME_ZONE,
  TODAY,
} from "../test-support";
import { DoctorDashboard } from "./doctor-dashboard";

const api = vi.hoisted(() => ({
  readOwnQueue: vi.fn(),
  readNextOwnAppointments: vi.fn(),
  readOwnRecords: vi.fn(),
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

const d = messagesByLocale.en.dashboard;
const panel = async (name: string) =>
  within(await screen.findByRole("region", { name }));

const entry = (id: number, status: string) => ({
  id,
  queue_number: id + 10,
  status,
  called_at: status === "with_doctor" ? "2026-11-11T07:30:00.000000Z" : null,
  patient: { full_name: `Synthetic Patient ${id}` },
});

beforeEach(() => {
  Object.values(api).forEach((read) => read.mockReset());
  api.readOwnQueue.mockResolvedValue(
    ok({
      current: entry(1, "with_doctor"),
      waiting: [3, 2, 4, 5, 6, 7, 8].map((id) => entry(id, "waiting")),
    }),
  );
  api.readNextOwnAppointments.mockResolvedValue(
    ok({
      rows: [
        {
          id: 21,
          date: TODAY,
          start: "13:00",
          end: "13:20",
          patient: { full_name: "Synthetic Later" },
        },
      ],
      total: 1,
    }),
  );
  api.readOwnRecords.mockResolvedValue(
    ok({ from: "2026-08-12", to: TODAY, none: 4, draft: 2 }),
  );
});
afterEach(cleanup);

describe("DoctorDashboard", () => {
  it("shows the patient with the doctor, their number, and when they were called in the clinic's time", async () => {
    renderDashboard(<DoctorDashboard timeZone={TIME_ZONE} />, "doctor");
    const now = await panel(d.now.heading);

    expect(await now.findByText("Synthetic Patient 1")).toBeTruthy();
    expect(now.getByText(d.now.number).nextSibling?.textContent).toBe("11");
    // 07:30 UTC is 09:30 in Cairo.
    expect(now.getByText(d.now.calledAt).nextSibling?.textContent).toMatch(
      /9:30/,
    );
    expect(
      now.getByRole("link", { name: d.now.link }).getAttribute("href"),
    ).toBe("/my/queue");
  });

  it("lists everyone waiting, in the API's order, even beyond five", async () => {
    renderDashboard(<DoctorDashboard timeZone={TIME_ZONE} />, "doctor");
    const waiting = await panel(d.waiting.heading);

    const list = await waiting.findByRole("list", {
      name: d.waiting.listLabel,
    });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(
      [3, 2, 4, 5, 6, 7, 8].map((id) => `${id + 10}Synthetic Patient ${id}`),
    );
    expect(
      waiting.getByText(d.waiting.count, { selector: "dt" }).nextSibling
        ?.textContent,
    ).toBe("7");
  });

  it("reads the doctor's list once for both of its panels", async () => {
    renderDashboard(<DoctorDashboard timeZone={TIME_ZONE} />, "doctor");
    await screen.findByText("Synthetic Patient 1");
    expect(api.readOwnQueue).toHaveBeenCalledOnce();
  });

  it("lists later appointments, each opening its own page", async () => {
    renderDashboard(<DoctorDashboard timeZone={TIME_ZONE} />, "doctor");
    const later = await panel(d.later.heading);

    expect(
      (
        await later.findByRole("link", { name: /Synthetic Later/ })
      ).getAttribute("href"),
    ).toBe("/my/appointments/21");
    expect(
      later.getByRole("link", { name: d.later.link }).getAttribute("href"),
    ).toBe("/my/appointments?status=scheduled");
  });

  it("counts records to finish over the period read, each leading to My visits filtered", async () => {
    renderDashboard(<DoctorDashboard timeZone={TIME_ZONE} />, "doctor");
    const records = await panel(d.records.heading);

    expect(
      (
        await records.findByRole("link", { name: `${d.records.none}: 4` })
      ).getAttribute("href"),
    ).toBe(`/my/visits?from=2026-08-12&to=${TODAY}&record_status=none`);
    expect(
      records
        .getByRole("link", { name: `${d.records.draft}: 2` })
        .getAttribute("href"),
    ).toBe(`/my/visits?from=2026-08-12&to=${TODAY}&record_status=draft`);
    expect(records.getByText("2026-08-12")).toBeTruthy();
  });

  it("says so in words when nobody is with the doctor or waiting, and nothing lacks a record", async () => {
    api.readOwnQueue.mockResolvedValue(ok({ current: null, waiting: [] }));
    api.readNextOwnAppointments.mockResolvedValue(ok({ rows: [], total: 0 }));
    api.readOwnRecords.mockResolvedValue(
      ok({ from: "2026-08-12", to: TODAY, none: 0, draft: 0 }),
    );
    renderDashboard(<DoctorDashboard timeZone={TIME_ZONE} />, "doctor");

    expect(await screen.findByText(d.now.empty)).toBeTruthy();
    expect(screen.getByText(d.waiting.empty)).toBeTruthy();
    expect(await screen.findByText(d.later.empty)).toBeTruthy();
    expect(await screen.findByText(d.records.empty)).toBeTruthy();
  });

  it("offers no action that changes the queue or opens a record", async () => {
    renderDashboard(<DoctorDashboard timeZone={TIME_ZONE} />, "doctor");
    await screen.findByText("Synthetic Patient 1");
    await screen.findByText("Synthetic Later");

    // The only buttons are each panel's Refresh.
    const refresh = messagesByLocale.en.shared.lastRead.refresh;
    expect(
      screen
        .getAllByRole("button")
        .every((button) => button.textContent === refresh),
    ).toBe(true);
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).not.toMatch(
        /^\/(my\/encounters|my\/patients|patients)/,
      );
    }
  });

  it("says the doctor profile can't be found when the API answers 404", async () => {
    api.readOwnQueue.mockResolvedValue(refused(404));
    renderDashboard(<DoctorDashboard timeZone={TIME_ZONE} />, "doctor");

    expect(
      await (await panel(d.now.heading)).findByText(d.panel.profileNotFound),
    ).toBeTruthy();
    expect(
      (await panel(d.waiting.heading)).getByText(d.panel.profileNotFound),
    ).toBeTruthy();
    // The other panels still read and show their own.
    expect(
      await (await panel(d.later.heading)).findByText("Synthetic Later"),
    ).toBeTruthy();
  });
});
