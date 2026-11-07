import { beforeEach, describe, expect, it, vi } from "vitest";
import { readAppointments, readOwnAppointments } from "./appointments-server";

const serverApi = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/server-api", () => ({ serverApi }));

beforeEach(() => {
  serverApi.mockReset();
  serverApi.mockResolvedValue({
    ok: true,
    status: 200,
    data: {
      data: [],
      meta: {
        current_page: 1,
        last_page: 1,
        per_page: 15,
        total: 0,
        from: null,
        to: null,
      },
    },
  });
});

describe("reading appointments", () => {
  it("sends the filters set, and leaves the rest out", async () => {
    await readAppointments("en", {
      from: "2026-11-07",
      to: "2026-11-07",
      doctor_id: "3",
      patient_id: undefined,
      status: "",
    });

    expect(serverApi).toHaveBeenCalledWith(
      "appointments?from=2026-11-07&to=2026-11-07&doctor_id=3",
      { locale: "en" },
    );
  });

  it("reads a doctor's own from their own path", async () => {
    await readOwnAppointments("ar", { from: "2026-11-07", to: "2026-11-08" });

    expect(serverApi).toHaveBeenCalledWith(
      "doctors/me/appointments?from=2026-11-07&to=2026-11-08",
      { locale: "ar" },
    );
  });
});
