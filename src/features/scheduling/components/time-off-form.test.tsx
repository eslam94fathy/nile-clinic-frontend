import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { TimeOffForm } from "./time-off-form";

afterEach(cleanup);

const recordTimeOff = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("../api/time-off", () => ({ recordTimeOff, removeTimeOff: vi.fn() }));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ refresh }),
}));
vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));

const t = messagesByLocale.en.scheduling;
const { shared } = messagesByLocale.en;

const escaped = (text: string) => text.replace(/[()]/g, "\\$&");
const field = (label: string) =>
  screen.getByLabelText(new RegExp(`^${escaped(label)}`)) as HTMLInputElement;
const type = (label: string, value: string) =>
  fireEvent.change(field(label), { target: { value } });
const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: t.add }));
const setup = () => renderWithIntl(<TimeOffForm doctorId={5} />);

const OK = { ok: true, status: 201, data: null };

beforeEach(() => {
  for (const mock of [recordTimeOff, refresh, toastSuccess]) mock.mockReset();
});

describe("TimeOffForm", () => {
  it("records whole days, sending no times, and leaves out a blank reason", async () => {
    recordTimeOff.mockResolvedValue(OK);
    setup();
    type(t.startDate, "2030-01-10");
    type(t.endDate, "2030-01-12");
    submit();

    await waitFor(() =>
      expect(recordTimeOff).toHaveBeenCalledWith(
        5,
        { start_date: "2030-01-10", end_date: "2030-01-12" },
        "en",
      ),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(toastSuccess).toHaveBeenCalledWith(t.added);
  });

  it("records part of one day, with the same date at both ends", async () => {
    recordTimeOff.mockResolvedValue(OK);
    setup();
    type(t.kind, "part");
    type(t.startDate, "2030-01-10");
    type(t.startTime, "10:00");
    type(t.endTime, "١٢:٠٠");
    type(t.reasonLabel, "Conference");
    submit();

    await waitFor(() =>
      expect(recordTimeOff).toHaveBeenCalledWith(
        5,
        {
          start_date: "2030-01-10",
          end_date: "2030-01-10",
          start_time: "10:00",
          end_time: "12:00",
          reason: "Conference",
        },
        "en",
      ),
    );
  });

  it("ignores spaces around a time, as the schedule editor does", async () => {
    recordTimeOff.mockResolvedValue(OK);
    setup();
    type(t.kind, "part");
    type(t.startDate, "2030-01-10");
    type(t.startTime, "10:00 ");
    type(t.endTime, " 12:00");
    submit();

    await waitFor(() =>
      expect(recordTimeOff).toHaveBeenCalledWith(
        5,
        {
          start_date: "2030-01-10",
          end_date: "2030-01-10",
          start_time: "10:00",
          end_time: "12:00",
        },
        "en",
      ),
    );
  });

  it("hides the last day and asks for times when it's part of a day", () => {
    setup();
    expect(screen.queryByLabelText(new RegExp(`^${t.startTime}`))).toBeNull();
    type(t.kind, "part");

    expect(screen.queryByLabelText(new RegExp(`^${t.endDate}`))).toBeNull();
    expect(field(t.startTime)).toBeTruthy();
    expect(field(t.endTime)).toBeTruthy();
  });

  it("requires the dates", async () => {
    setup();
    submit();

    expect((await screen.findAllByText(t.dateRequired)).length).toBe(2);
    expect(recordTimeOff).not.toHaveBeenCalled();
  });

  it("gives quick feedback on a time's format", async () => {
    setup();
    type(t.kind, "part");
    type(t.startDate, "2030-01-10");
    type(t.startTime, "10:03");
    type(t.endTime, "12:00");
    submit();

    await screen.findByText(t.timeFormat);
    expect(recordTimeOff).not.toHaveBeenCalled();
  });

  it("allows a reason of at most 255 characters", async () => {
    setup();
    type(t.startDate, "2030-01-10");
    type(t.endDate, "2030-01-10");
    type(t.reasonLabel, "x".repeat(256));
    submit();

    await screen.findByText(t.reasonTooLong);
    expect(recordTimeOff).not.toHaveBeenCalled();
  });

  it("warns about medical details, and that all staff can read it", () => {
    setup();
    expect(screen.getByText(shared.form.noMedicalDetails)).toBeTruthy();
    expect(screen.getByText(t.reasonHint)).toBeTruthy();
    expect(field(t.reasonLabel).getAttribute("aria-describedby")).toBeTruthy();
  });

  it("says that existing appointments aren't changed", () => {
    setup();
    expect(screen.getByText(t.appointmentsNote)).toBeTruthy();
  });

  it.each([
    ["start_date", () => t.startDate],
    ["end_date", () => t.endDate],
    ["reason", () => t.reasonLabel],
  ])("shows a refusal on %s", async (key, label) => {
    recordTimeOff.mockResolvedValue({
      ok: false,
      error: { status: 422, fieldErrors: { [key]: ["Refused here."] } },
    });
    setup();
    type(t.startDate, "2030-01-10");
    type(t.endDate, "2030-01-12");
    submit();

    await screen.findByText("Refused here.");
    expect(field(label()).getAttribute("aria-invalid")).toBe("true");
  });

  it("shows a refusal on a part-day time", async () => {
    recordTimeOff.mockResolvedValue({
      ok: false,
      error: { status: 422, fieldErrors: { end_time: ["Too early."] } },
    });
    setup();
    type(t.kind, "part");
    type(t.startDate, "2030-01-10");
    type(t.startTime, "10:00");
    type(t.endTime, "09:00");
    submit();

    await screen.findByText("Too early.");
    expect(field(t.endTime).getAttribute("aria-invalid")).toBe("true");
  });

  it("sends one request while pending", async () => {
    recordTimeOff.mockReturnValue(new Promise(() => {}));
    setup();
    type(t.startDate, "2030-01-10");
    type(t.endDate, "2030-01-10");
    submit();

    const button = await screen.findByRole("button", { name: t.adding });
    fireEvent.submit(button.closest("form") as HTMLFormElement);
    await waitFor(() => expect(recordTimeOff).toHaveBeenCalledTimes(1));
  });
});
