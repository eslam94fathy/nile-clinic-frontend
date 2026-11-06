import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import type { Schedule } from "../types";
import { ScheduleEditor } from "./schedule-editor";

afterEach(cleanup);

const saveSchedule = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("../api/schedule", () => ({ saveSchedule, clearSchedule: vi.fn() }));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));
vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));

const t = messagesByLocale.en.scheduling;
const { days, shared } = messagesByLocale.en;

const empty = (
  [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ] as const
).map((day) => ({ day, periods: [] as { start: string; end: string }[] }));

const noSchedule: Schedule = {
  doctor_id: 5,
  appointment_minutes: null,
  days: empty,
  updated_at: null,
};

function withPeriods(
  entries: Partial<Record<string, { start: string; end: string }[]>>,
): Schedule {
  return {
    doctor_id: 5,
    appointment_minutes: 20,
    days: empty.map(({ day }) => ({ day, periods: entries[day] ?? [] })),
    updated_at: "2026-01-01T00:00:00.000000Z",
  };
}

const setup = (schedule: Schedule = noSchedule) =>
  renderWithIntl(<ScheduleEditor doctorId={5} schedule={schedule} />);

const startOf = (number: number, day: string) =>
  screen.getByLabelText(
    new RegExp(`^Start of period ${number} on ${day}`),
  ) as HTMLInputElement;
const endOf = (number: number, day: string) =>
  screen.getByLabelText(
    new RegExp(`^End of period ${number} on ${day}`),
  ) as HTMLInputElement;
const add = (day: string) =>
  fireEvent.click(
    screen.getByRole("button", { name: `Add a period on ${day}` }),
  );
const save = () =>
  fireEvent.click(screen.getByRole("button", { name: t.save }));
const type = (input: HTMLInputElement, value: string) =>
  fireEvent.change(input, { target: { value } });
const length = () =>
  screen.getByLabelText(
    new RegExp(`^${t.appointmentMinutes}`),
  ) as HTMLInputElement;

const OK = { ok: true, status: 200, data: { data: noSchedule } };

beforeEach(() => {
  for (const mock of [saveSchedule, push, refresh, toastSuccess]) {
    mock.mockReset();
  }
});

describe("ScheduleEditor", () => {
  it("shows all seven days, Sunday first, translated", () => {
    setup();
    const headings = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual([
      days.sunday,
      days.monday,
      days.tuesday,
      days.wednesday,
      days.thursday,
      days.friday,
      days.saturday,
    ]);
  });

  it("says that existing appointments aren't moved", () => {
    setup();
    expect(screen.getByText(t.appointmentsNote)).toBeTruthy();
  });

  it("loads the saved week, including 24:00", () => {
    setup(withPeriods({ monday: [{ start: "18:00", end: "24:00" }] }));

    expect(length().value).toBe("20");
    expect(startOf(1, days.monday).value).toBe("18:00");
    expect(endOf(1, days.monday).value).toBe("24:00");
  });

  it("sends rows in screen order, whatever order they were added in", async () => {
    saveSchedule.mockResolvedValue(OK);
    setup();
    type(length(), "30");

    add(days.tuesday);
    type(startOf(1, days.tuesday), "10:00");
    type(endOf(1, days.tuesday), "14:00");
    add(days.sunday);
    type(startOf(1, days.sunday), "09:00");
    type(endOf(1, days.sunday), "13:00");
    add(days.sunday);
    type(startOf(2, days.sunday), "17:00");
    type(endOf(2, days.sunday), "24:00");
    save();

    await waitFor(() =>
      expect(saveSchedule).toHaveBeenCalledWith(
        5,
        {
          appointment_minutes: 30,
          periods: [
            { day: "sunday", start: "09:00", end: "13:00" },
            { day: "sunday", start: "17:00", end: "24:00" },
            { day: "tuesday", start: "10:00", end: "14:00" },
          ],
        },
        "en",
      ),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/doctors/5"));
    expect(refresh).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith(t.saved);
  });

  it("accepts Arabic digits in times and sends Western ones", async () => {
    saveSchedule.mockResolvedValue(OK);
    setup();
    type(length(), "٢٠");
    add(days.monday);
    type(startOf(1, days.monday), "٠٩:٣٠");
    type(endOf(1, days.monday), "١٢:٠٠");
    save();

    await waitFor(() =>
      expect(saveSchedule).toHaveBeenCalledWith(
        5,
        {
          appointment_minutes: 20,
          periods: [{ day: "monday", start: "09:30", end: "12:00" }],
        },
        "en",
      ),
    );
  });

  it("allows an empty week, which the API accepts", async () => {
    saveSchedule.mockResolvedValue(OK);
    setup();
    type(length(), "20");
    save();

    await waitFor(() =>
      expect(saveSchedule).toHaveBeenCalledWith(
        5,
        { appointment_minutes: 20, periods: [] },
        "en",
      ),
    );
  });

  it.each(["9:00", "09:03", "25:00", "24:05", "abc", ""])(
    "gives quick feedback on the time %j",
    async (value) => {
      setup();
      type(length(), "20");
      add(days.monday);
      type(startOf(1, days.monday), value);
      type(endOf(1, days.monday), "12:00");
      save();

      await screen.findByText(t.timeFormat);
      expect(saveSchedule).not.toHaveBeenCalled();
    },
  );

  it("refuses 24:00 as a start", async () => {
    setup();
    type(length(), "20");
    add(days.monday);
    type(startOf(1, days.monday), "24:00");
    type(endOf(1, days.monday), "24:00");
    save();

    await screen.findByText(t.timeFormat);
    expect(saveSchedule).not.toHaveBeenCalled();
  });

  it.each(["", "3", "7", "245", "20.5", "abc"])(
    "gives quick feedback on a length of %j",
    async (value) => {
      setup();
      type(length(), value);
      save();

      await screen.findByText(t.minutesRule);
      expect(saveSchedule).not.toHaveBeenCalled();
    },
  );

  it("stops at four periods a day, and says why", () => {
    setup();
    for (let index = 0; index < 4; index += 1) add(days.friday);

    const button = screen.getByRole("button", {
      name: `Add a period on ${days.friday}`,
    });
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(t.tooManyPeriods)).toBeTruthy();
  });

  it("removes a row", () => {
    setup(withPeriods({ monday: [{ start: "09:00", end: "12:00" }] }));
    fireEvent.click(
      screen.getByRole("button", {
        name: `Remove period 1 on ${days.monday}`,
      }),
    );
    expect(screen.queryByLabelText(/^Start of period 1 on Monday/)).toBeNull();
  });

  it("shows a refusal against its exact period, after rows were added mid-week", async () => {
    saveSchedule.mockResolvedValue({
      ok: false,
      error: {
        status: 422,
        fieldErrors: { "periods.1": ["These periods overlap."] },
      },
    });
    setup(
      withPeriods({
        sunday: [{ start: "09:00", end: "13:00" }],
        tuesday: [{ start: "10:00", end: "14:00" }],
      }),
    );
    add(days.monday);
    type(startOf(1, days.monday), "08:00");
    type(endOf(1, days.monday), "09:00");
    save();

    // Index 1 is Monday's new row: Sunday is 0 and Tuesday has moved to 2.
    const message = await screen.findByText("These periods overlap.");
    const row = message.closest("[data-period-row]") as HTMLElement;
    expect(
      within(row).getByLabelText(/^Start of period 1 on Monday/),
    ).toBeTruthy();
    // Everything stays, for correction.
    expect(startOf(1, days.tuesday).value).toBe("10:00");
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a format refusal on its exact field", async () => {
    saveSchedule.mockResolvedValue({
      ok: false,
      error: {
        status: 422,
        fieldErrors: { "periods.0.end": ["The end is not valid."] },
      },
    });
    setup(withPeriods({ sunday: [{ start: "09:00", end: "13:00" }] }));
    save();

    await screen.findByText("The end is not valid.");
    expect(endOf(1, days.sunday).getAttribute("aria-invalid")).toBe("true");
    expect(startOf(1, days.sunday).getAttribute("aria-invalid")).toBeNull();
  });

  it("shows other refusals in their place, dropping none", async () => {
    saveSchedule.mockResolvedValue({
      ok: false,
      error: {
        status: 422,
        fieldErrors: {
          appointment_minutes: ["Bad length."],
          periods: ["Too many."],
          other: ["Something else."],
        },
      },
    });
    setup(withPeriods({ sunday: [{ start: "09:00", end: "13:00" }] }));
    save();

    expect(await screen.findByText("Bad length.")).toBeTruthy();
    expect(screen.getByText("Too many.")).toBeTruthy();
    expect(screen.getByText("Something else.")).toBeTruthy();
  });

  it("offers to clear only a saved schedule", () => {
    setup();
    expect(screen.queryByRole("button", { name: t.clear })).toBeNull();
    cleanup();
    setup(withPeriods({ monday: [{ start: "09:00", end: "12:00" }] }));
    expect(screen.getByRole("button", { name: t.clear })).toBeTruthy();
  });

  it("explains what clearing does", async () => {
    setup(withPeriods({ monday: [{ start: "09:00", end: "12:00" }] }));
    fireEvent.click(screen.getByRole("button", { name: t.clear }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain(t.clearDescription);
    expect(shared.confirm.cancel).toBeTruthy();
  });
});
