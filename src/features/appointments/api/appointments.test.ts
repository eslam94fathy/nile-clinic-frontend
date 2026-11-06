import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  bookAppointment,
  cancelAppointment,
  markNoShow,
  rescheduleAppointment,
} from "./appointments";

const browserApi = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/browser-api", () => ({ browserApi }));

const appointment = {
  id: 7,
  date: "2026-11-08",
  start: "09:20",
  end: "09:40",
  status: "scheduled",
  outside_availability: false,
  doctor: { id: 3, name: "Synthetic Doctor", title: "Consultant" },
  patient: { id: 12, full_name: "Synthetic Patient", phone: "01000000001" },
  note: null,
  booked_by: { id: 1, name: "Synthetic Staff" },
  booked_at: "2026-11-05T14:22:31.000000Z",
  rescheduled_by: null,
  rescheduled_at: null,
  status_changed_by: null,
  status_changed_at: null,
  cancellation_reason: null,
};
const answer = { ok: true, status: 200, data: { data: appointment } };

beforeEach(() => {
  browserApi.mockReset();
  browserApi.mockResolvedValue(answer);
});

describe("appointment changes", () => {
  it("books, returning the appointment", async () => {
    const body = {
      patient_id: 12,
      doctor_id: 3,
      date: "2026-11-08",
      start: "09:20",
    };
    const result = await bookAppointment(body, "en");

    expect(browserApi).toHaveBeenCalledWith("appointments", {
      method: "POST",
      json: body,
      locale: "en",
    });
    expect(result.ok && result.data.id).toBe(7);
  });

  it("reschedules, sending only the date and start", async () => {
    await rescheduleAppointment(
      7,
      { date: "2026-11-10", start: "10:00" },
      "ar",
    );

    expect(browserApi).toHaveBeenCalledWith("appointments/7/reschedule", {
      method: "POST",
      json: { date: "2026-11-10", start: "10:00" },
      locale: "ar",
    });
  });

  it("cancels", async () => {
    await cancelAppointment(7, { reason: "Patient travelling" }, "en");

    expect(browserApi).toHaveBeenCalledWith("appointments/7/cancel", {
      method: "POST",
      json: { reason: "Patient travelling" },
      locale: "en",
    });
  });

  it("marks a no-show, with no body", async () => {
    await markNoShow(7, "en");

    expect(browserApi).toHaveBeenCalledWith("appointments/7/no-show", {
      method: "POST",
      locale: "en",
    });
  });

  it("passes a refusal on untouched", async () => {
    const refused = {
      ok: false,
      error: { status: 409, fieldErrors: {}, reason: "slot_booked" },
    };
    browserApi.mockResolvedValue(refused);

    expect(
      await bookAppointment(
        { patient_id: 1, doctor_id: 1, date: "2026-11-08", start: "09:20" },
        "en",
      ),
    ).toEqual(refused);
  });

  it("treats an answer of the wrong shape as a failure with no known outcome", async () => {
    browserApi.mockResolvedValue({ ok: true, status: 200, data: {} });

    const result = await markNoShow(7, "en");

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.status).toBe(0);
  });
});
