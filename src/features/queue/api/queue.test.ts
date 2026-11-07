import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addWalkIn,
  callNext,
  checkInAppointment,
  finishVisit,
  markLeft,
  readClinicQueue,
  readDoctorQueue,
  readOwnQueue,
  undoCheckIn,
} from "./queue";

const { browserApi } = vi.hoisted(() => ({ browserApi: vi.fn() }));
vi.mock("@/lib/api/browser-api", () => ({ browserApi }));

const fields = {
  id: 5,
  queue_number: 3,
  status: "waiting",
  walk_in: false,
  arrived_at: "2026-11-07T08:00:00.000000Z",
  called_at: null,
  finished_at: null,
  left_at: null,
  appointment: { id: 7, start: "09:20", end: "09:40" },
};
const entry = {
  ...fields,
  doctor: { id: 3, name: "Synthetic Doctor", title: "Consultant" },
  patient: { id: 12, full_name: "Synthetic Patient", phone: "01000000001" },
};
const own = {
  ...fields,
  patient: {
    id: 12,
    full_name: "Synthetic Patient",
    sex: "female",
    date_of_birth: "1990-04-12",
  },
};
const meta = {
  current_page: 1,
  last_page: 1,
  per_page: 100,
  total: 1,
  from: 1,
  to: 1,
};
const answer = (data: unknown, status = 200) => ({ ok: true, status, data });
const refused = {
  ok: false,
  error: { status: 422, fieldErrors: { entry: ["Refused."] } },
};

beforeEach(() => browserApi.mockReset());

describe("reads", () => {
  it("reads the clinic's list at the largest page", async () => {
    browserApi.mockResolvedValue(answer({ data: [entry], meta }));
    const result = await readClinicQueue({ status: null, page: 1 }, "ar");

    expect(browserApi).toHaveBeenCalledWith("queue?page=1&per_page=100", {
      locale: "ar",
    });
    expect(result.ok && result.data.data).toEqual([entry]);
  });

  it("sends a status and page when set", async () => {
    browserApi.mockResolvedValue(answer({ data: [], meta }));
    await readClinicQueue({ status: "seen", page: 2 }, "en");

    expect(browserApi).toHaveBeenCalledWith(
      "queue?status=seen&page=2&per_page=100",
      { locale: "en" },
    );
  });

  it("reads one doctor's list, which has no page or status", async () => {
    browserApi.mockResolvedValue(answer({ data: [entry] }));
    await readDoctorQueue(3, "en");

    expect(browserApi).toHaveBeenCalledWith("doctors/3/queue", {
      locale: "en",
    });
  });

  it("reads the doctor's own list", async () => {
    browserApi.mockResolvedValue(answer({ data: [own] }));
    const result = await readOwnQueue("en");

    expect(browserApi).toHaveBeenCalledWith("doctors/me/queue", {
      locale: "en",
    });
    expect(result.ok && result.data.data[0]?.patient.sex).toBe("female");
  });

  it("treats a body of the wrong shape as a failed read", async () => {
    browserApi.mockResolvedValue(answer({ data: [{ id: 5 }] }));
    const result = await readOwnQueue("en");

    expect(result.ok).toBe(false);
  });

  it("passes a refusal on", async () => {
    browserApi.mockResolvedValue(refused);
    expect(await readDoctorQueue(3, "en")).toEqual(refused);
  });
});

describe("actions", () => {
  it.each([
    [
      "check-in",
      () => checkInAppointment(7, "ar"),
      "appointments/7/check-in",
      entry,
    ],
    ["leaving", () => markLeft(5, "ar"), "queue/5/leave", entry],
    ["call next", () => callNext("ar"), "doctors/me/queue/call-next", own],
    ["finish", () => finishVisit("ar"), "doctors/me/queue/finish", own],
  ] as const)(
    "%s posts with no body, and gives back the entry",
    async (_name, call, path, body) => {
      browserApi.mockResolvedValue(answer({ data: body }, 201));
      const result = await call();

      expect(browserApi).toHaveBeenCalledTimes(1);
      expect(browserApi).toHaveBeenCalledWith(path, {
        method: "POST",
        locale: "ar",
      });
      expect(result.ok && result.data.id).toBe(5);
    },
  );

  it("adds a walk-in with exactly the patient and doctor", async () => {
    browserApi.mockResolvedValue(answer({ data: entry }, 201));
    await addWalkIn({ patient_id: 12, doctor_id: 3 }, "en");

    expect(browserApi).toHaveBeenCalledWith("queue/walk-ins", {
      method: "POST",
      json: { patient_id: 12, doctor_id: 3 },
      locale: "en",
    });
  });

  it("undoes with a delete, whose answer has no body", async () => {
    browserApi.mockResolvedValue(answer(null, 204));
    const result = await undoCheckIn(5, "en");

    expect(browserApi).toHaveBeenCalledWith("queue/5", {
      method: "DELETE",
      locale: "en",
    });
    expect(result).toEqual({ ok: true, status: 204, data: null });
  });

  it("passes a refusal on, and doesn't repeat the action", async () => {
    browserApi.mockResolvedValue(refused);

    expect(await markLeft(5, "en")).toEqual(refused);
    expect(await undoCheckIn(5, "en")).toEqual(refused);
    expect(browserApi).toHaveBeenCalledTimes(2);
  });
});
