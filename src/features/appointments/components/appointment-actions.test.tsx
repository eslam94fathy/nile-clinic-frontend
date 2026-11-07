import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import type { Appointment } from "../types";
import { AppointmentActions } from "./appointment-actions";
import { DETAILS_HEADING_ID } from "./appointment-details";

const api = vi.hoisted(() => ({
  cancelAppointment: vi.fn(),
  markNoShow: vi.fn(),
  rescheduleAppointment: vi.fn(),
}));
vi.mock("../api/appointments", () => api);
const queue = vi.hoisted(() => ({ checkInAppointment: vi.fn() }));
vi.mock("@/features/queue/public", () => queue);
vi.mock("@/features/patients/public", () => ({
  PatientLink: () => null,
}));

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
  useRouter: () => router,
}));
const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const freeTimes = vi.hoisted(() => ({ doctor: 0, signal: 0 }));
vi.mock("@/features/scheduling/public", () => ({
  FreeTimes: ({
    doctorId,
    value,
    onChange,
    refreshSignal,
    error,
  }: {
    doctorId: number;
    value: { start: string } | null;
    onChange: (time: { date: string; start: string } | null) => void;
    refreshSignal: number;
    error?: string;
  }) => {
    freeTimes.doctor = doctorId;
    freeTimes.signal = refreshSignal;
    return (
      <div>
        <span>{`Time: ${value?.start ?? "none"}`}</span>
        {error ? <span>{`Time error: ${error}`}</span> : null}
        <button
          onClick={() => onChange({ date: "2026-11-10", start: "10:00" })}
        >
          {"Pick time"}
        </button>
      </div>
    );
  },
}));

const t = messagesByLocale.en.appointments;
const { confirm } = messagesByLocale.en.shared;

const appointment: Appointment = {
  id: 7,
  date: "2026-11-08",
  start: "09:20",
  end: "09:40",
  status: "scheduled",
  outside_availability: false,
  doctor: { id: 3, name: "Synthetic Doctor", title: "Consultant" },
  patient: { id: 12, full_name: "Synthetic Patient", phone: "01000000001" },
  note: null,
  booked_by: null,
  booked_at: "2026-11-05T14:22:31.000000Z",
  rescheduled_by: null,
  rescheduled_at: null,
  status_changed_by: null,
  status_changed_at: null,
  cancellation_reason: null,
};
const BEFORE = "2026-11-07 09:00";
const AFTER = "2026-11-08 10:00";

beforeEach(() => {
  for (const mock of Object.values(api)) mock.mockReset();
  queue.checkInAppointment.mockReset();
  router.refresh.mockReset();
  toast.success.mockReset();
  freeTimes.signal = 0;
  document.body.replaceChildren();
  const heading = document.createElement("h2");
  heading.id = DETAILS_HEADING_ID;
  heading.tabIndex = -1;
  document.body.append(heading);
});
afterEach(cleanup);

function setUp(clinicNow = BEFORE, changes: Partial<Appointment> = {}) {
  return renderWithIntl(
    <AppointmentActions
      appointment={{ ...appointment, ...changes }}
      today="2026-11-07"
      clinicNow={clinicNow}
    />,
  );
}

const press = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));
const dialog = () => screen.getByRole("alertdialog");

describe("checking in", () => {
  const ON_THE_DAY = "2026-11-08 09:00";

  it("is offered on the day, with no confirmation, and gives the number", async () => {
    queue.checkInAppointment.mockResolvedValue({
      ok: true,
      status: 201,
      data: { queue_number: 4 },
    });
    setUp(ON_THE_DAY);
    press(t.checkIn.action);

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        t.checkIn.done.replace("{number}", "4"),
      ),
    );
    expect(queue.checkInAppointment).toHaveBeenCalledWith(7, "en");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("isn't offered on another date", () => {
    setUp();
    expect(screen.queryByRole("button", { name: t.checkIn.action })).toBeNull();
  });

  it("shows a refusal on the page, and refreshes", async () => {
    queue.checkInAppointment.mockResolvedValue({
      ok: false,
      error: {
        status: 422,
        fieldErrors: { appointment: ["Sent as written."] },
      },
    });
    setUp(ON_THE_DAY);
    press(t.checkIn.action);

    await screen.findByText("Sent as written.");
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("shows a conflict's message, as there's no key to go by", async () => {
    queue.checkInAppointment.mockResolvedValue({
      ok: false,
      error: {
        status: 409,
        message: "Already.",
        reason: "already_checked_in",
        fieldErrors: {},
      },
    });
    setUp(ON_THE_DAY);
    press(t.checkIn.action);

    await screen.findByText("Already.");
  });

  it("says it can't tell when no answer came", async () => {
    queue.checkInAppointment.mockResolvedValue({
      ok: false,
      error: { status: 0, fieldErrors: {} },
    });
    setUp(ON_THE_DAY);
    press(t.checkIn.action);

    await screen.findByText(t.actions.unknownOutcome);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("doesn't send twice while one is under way", async () => {
    queue.checkInAppointment.mockReturnValue(new Promise(() => {}));
    setUp(ON_THE_DAY);
    press(t.checkIn.action);
    press(t.checkIn.working);

    await waitFor(() =>
      expect(queue.checkInAppointment).toHaveBeenCalledTimes(1),
    );
  });

  it("links a checked-in appointment to that doctor's list, offering no change", () => {
    setUp(ON_THE_DAY, { status: "checked_in" });
    const link = screen.getByRole("link", { name: t.checkIn.seeList });

    expect(link.getAttribute("href")).toBe("/queue?doctor_id=3");
    expect(link.getAttribute("data-prefetch")).toBe("false");
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("what's offered", () => {
  it("before the day: moving and cancelling, and no check-in", () => {
    setUp();
    expect(
      screen.getByRole("button", { name: t.actions.reschedule }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: t.actions.cancel })).toBeTruthy();
    expect(screen.queryByRole("button", { name: t.actions.noShow })).toBeNull();
    expect(screen.queryByText(/check/i)).toBeNull();
  });

  it("after the start: only a no-show", () => {
    setUp(AFTER);
    expect(screen.getByRole("button", { name: t.actions.noShow })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: t.actions.reschedule }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: t.actions.cancel })).toBeNull();
  });

  it("any other status: nothing", () => {
    setUp(BEFORE, { status: "cancelled" });
    expect(
      screen.queryByRole("heading", { name: t.actions.heading }),
    ).toBeNull();
  });
});

describe("rescheduling", () => {
  it("uses the same doctor, and sends the date and start", async () => {
    api.rescheduleAppointment.mockResolvedValue({
      ok: true,
      status: 200,
      data: appointment,
    });
    setUp();
    press(t.actions.reschedule);

    expect(freeTimes.doctor).toBe(3);
    expect(screen.getByText(t.reschedule.sameDoctor)).toBeTruthy();
    press("Pick time");
    press(t.reschedule.submit);

    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(api.rescheduleAppointment).toHaveBeenCalledWith(
      7,
      { date: "2026-11-10", start: "10:00" },
      "en",
    );
    expect(toast.success).toHaveBeenCalledWith(t.reschedule.moved);
    expect(screen.queryByText(t.reschedule.heading)).toBeNull();
    expect(document.activeElement?.id).toBe(DETAILS_HEADING_ID);
  });

  it("needs a time", () => {
    setUp();
    press(t.actions.reschedule);
    press(t.reschedule.submit);

    expect(
      screen.getByText(`Time error: ${t.reschedule.chooseTime}`),
    ).toBeTruthy();
    expect(api.rescheduleAppointment).not.toHaveBeenCalled();
  });

  it("on a conflict: shows why, reads again, clears the time", async () => {
    api.rescheduleAppointment.mockResolvedValue({
      ok: false,
      error: {
        status: 409,
        fieldErrors: {},
        reason: "patient_busy",
        message: "This patient already has an appointment at this time.",
      },
    });
    setUp();
    press(t.actions.reschedule);
    press("Pick time");
    press(t.reschedule.submit);

    await screen.findByText(
      "This patient already has an appointment at this time.",
    );
    expect(screen.getByText("Time: none")).toBeTruthy();
    expect(freeTimes.signal).toBe(1);
    expect(
      screen
        .getByRole("link", { name: t.reschedule.seePatient })
        .getAttribute("href"),
    ).toBe("/appointments?patient_id=12&from=2026-11-10&to=2026-11-10");
    expect(screen.getByText(t.reschedule.heading)).toBeTruthy();
  });

  it("on a refused time: shows it on the free times", async () => {
    api.rescheduleAppointment.mockResolvedValue({
      ok: false,
      error: { status: 422, fieldErrors: { start: ["Not available."] } },
    });
    setUp();
    press(t.actions.reschedule);
    press("Pick time");
    press(t.reschedule.submit);

    await screen.findByText("Time error: Not available.");
    expect(freeTimes.signal).toBe(1);
  });

  it("when it can no longer change: closes, says so at page level, refreshes", async () => {
    api.rescheduleAppointment.mockResolvedValue({
      ok: false,
      error: {
        status: 422,
        fieldErrors: { appointment: ["Can no longer be changed."] },
      },
    });
    setUp();
    press(t.actions.reschedule);
    press("Pick time");
    press(t.reschedule.submit);

    await screen.findByText("Can no longer be changed.");
    expect(screen.queryByText(t.reschedule.heading)).toBeNull();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("when the API says it didn't happen: stays open, keeping the time", async () => {
    api.rescheduleAppointment.mockResolvedValue({
      ok: false,
      error: { status: 500, fieldErrors: {}, message: "It didn't happen." },
    });
    setUp();
    press(t.actions.reschedule);
    press("Pick time");
    press(t.reschedule.submit);

    await screen.findByText("It didn't happen.");
    expect(screen.getByText(t.reschedule.heading)).toBeTruthy();
    expect(screen.getByText("Time: 10:00")).toBeTruthy();
  });

  it("on an unknown outcome: says it can't tell, and refreshes", async () => {
    api.rescheduleAppointment.mockResolvedValue({
      ok: false,
      error: { status: 0, fieldErrors: {} },
    });
    setUp();
    press(t.actions.reschedule);
    press("Pick time");
    press(t.reschedule.submit);

    await screen.findByText(t.actions.unknownOutcome);
    expect(router.refresh).toHaveBeenCalled();
  });

  it("keeping the time sends nothing", () => {
    setUp();
    press(t.actions.reschedule);
    press(t.reschedule.keep);

    expect(screen.queryByText(t.reschedule.heading)).toBeNull();
    expect(api.rescheduleAppointment).not.toHaveBeenCalled();
  });
});

describe("cancelling", () => {
  it("warns, and sends the trimmed reason", async () => {
    api.cancelAppointment.mockResolvedValue({
      ok: true,
      status: 200,
      data: appointment,
    });
    setUp();
    press(t.actions.cancel);

    expect(dialog().textContent).toContain(confirm.irreversible);
    expect(dialog().textContent).toContain(
      messagesByLocale.en.shared.form.noMedicalDetails,
    );
    const reason = screen.getByLabelText(t.cancel.reasonLabel);
    expect(reason.getAttribute("autocomplete")).toBe("off");
    fireEvent.change(reason, { target: { value: "  Travelling " } });
    press(t.cancel.confirm);

    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(api.cancelAppointment).toHaveBeenCalledWith(
      7,
      { reason: "Travelling" },
      "en",
    );
    expect(toast.success).toHaveBeenCalledWith(t.cancel.done);
  });

  it("sends no reason when none is given", async () => {
    api.cancelAppointment.mockResolvedValue({
      ok: true,
      status: 200,
      data: appointment,
    });
    setUp();
    press(t.actions.cancel);
    press(t.cancel.confirm);

    await waitFor(() =>
      expect(api.cancelAppointment).toHaveBeenCalledWith(7, {}, "en"),
    );
  });

  it("checks the length, staying open", async () => {
    setUp();
    press(t.actions.cancel);
    fireEvent.change(screen.getByLabelText(t.cancel.reasonLabel), {
      target: { value: "x".repeat(256) },
    });
    press(t.cancel.confirm);

    await screen.findByText(t.cancel.reasonTooLong);
    expect(api.cancelAppointment).not.toHaveBeenCalled();
    expect(dialog()).toBeTruthy();
  });

  it("keeps the API's refusal of the reason in the dialog", async () => {
    api.cancelAppointment.mockResolvedValue({
      ok: false,
      error: { status: 422, fieldErrors: { reason: ["Too long."] } },
    });
    setUp();
    press(t.actions.cancel);
    press(t.cancel.confirm);

    await screen.findByText("Too long.");
    expect(dialog()).toBeTruthy();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("moves any other refusal to the page, and refreshes", async () => {
    api.cancelAppointment.mockResolvedValue({
      ok: false,
      error: {
        status: 422,
        fieldErrors: { appointment: ["Can no longer be changed."] },
      },
    });
    setUp();
    press(t.actions.cancel);
    press(t.cancel.confirm);

    await screen.findByText("Can no longer be changed.");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(router.refresh).toHaveBeenCalled();
    await waitFor(() =>
      expect(document.activeElement?.id).toBe(DETAILS_HEADING_ID),
    );
  });

  it("when the API says it didn't happen: keeps the reason for another try", async () => {
    api.cancelAppointment.mockResolvedValue({
      ok: false,
      error: { status: 500, fieldErrors: {}, message: "It didn't happen." },
    });
    setUp();
    press(t.actions.cancel);
    fireEvent.change(screen.getByLabelText(t.cancel.reasonLabel), {
      target: { value: "Travelling" },
    });
    press(t.cancel.confirm);

    await screen.findByText("It didn't happen.");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    press(t.actions.cancel);
    expect(
      screen.getByLabelText<HTMLTextAreaElement>(t.cancel.reasonLabel).value,
    ).toBe("Travelling");
  });

  it("says when it can't tell", async () => {
    api.cancelAppointment.mockResolvedValue({
      ok: false,
      error: { status: 502, fieldErrors: {} },
    });
    setUp();
    press(t.actions.cancel);
    press(t.cancel.confirm);

    await screen.findByText(t.actions.unknownOutcome);
    expect(router.refresh).toHaveBeenCalled();
  });

  it("sends one request, however many presses", async () => {
    let answer: (value: unknown) => void = () => {};
    api.cancelAppointment.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    setUp();
    press(t.actions.cancel);
    press(t.cancel.confirm);
    press(confirm.working);
    expect(api.cancelAppointment).toHaveBeenCalledTimes(1);

    answer({ ok: true, status: 200, data: appointment });
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("dismissing sends nothing", () => {
    setUp();
    press(t.actions.cancel);
    press(confirm.cancel);
    expect(api.cancelAppointment).not.toHaveBeenCalled();
  });
});

describe("a no-show", () => {
  it("warns, then records it", async () => {
    api.markNoShow.mockResolvedValue({
      ok: true,
      status: 200,
      data: appointment,
    });
    setUp(AFTER);
    press(t.actions.noShow);

    expect(dialog().textContent).toContain(confirm.irreversible);
    expect(api.markNoShow).not.toHaveBeenCalled();
    press(t.noShow.confirm);

    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(api.markNoShow).toHaveBeenCalledWith(7, "en");
    expect(toast.success).toHaveBeenCalledWith(t.noShow.done);
  });

  it("moves a refusal to the page", async () => {
    api.markNoShow.mockResolvedValue({
      ok: false,
      error: {
        status: 422,
        fieldErrors: { appointment: ["Has not started yet."] },
      },
    });
    setUp(AFTER);
    press(t.actions.noShow);
    press(t.noShow.confirm);

    await screen.findByText("Has not started yet.");
    expect(router.refresh).toHaveBeenCalled();
  });
});
