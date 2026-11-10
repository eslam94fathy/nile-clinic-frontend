import { beforeEach, describe, expect, it, vi } from "vitest";
import { readCharge, readCharges } from "./charges-server";

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

describe("reading charges", () => {
  it("sends the range and page, and leaves out filters not set", async () => {
    await readCharges("en", {
      from: "2026-11-02",
      to: "2026-11-08",
      patientId: null,
      doctorId: null,
      status: null,
      page: 1,
    });

    expect(serverApi).toHaveBeenCalledWith(
      "charges?from=2026-11-02&to=2026-11-08&page=1",
      { locale: "en" },
    );
  });

  it("sends a patient, a doctor, and a status", async () => {
    await readCharges("ar", {
      from: "2026-11-02",
      to: "2026-11-08",
      patientId: 12,
      doctorId: 3,
      status: "cancelled",
      page: 2,
    });

    expect(serverApi).toHaveBeenCalledWith(
      "charges?from=2026-11-02&to=2026-11-08&patient_id=12&doctor_id=3&status=cancelled&page=2",
      { locale: "ar" },
    );
  });

  it("reads one charge by its number", async () => {
    serverApi.mockResolvedValue({
      ok: false,
      error: { status: 404, fieldErrors: {} },
    });

    const result = await readCharge("en", 9);

    expect(serverApi).toHaveBeenCalledWith("charges/9", { locale: "en" });
    expect(!result.ok && result.error.status).toBe(404);
  });
});
