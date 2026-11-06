// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { getDoctorProfileStatus } from "./doctor-profile";

const serverApi = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/server-api", () => ({ serverApi }));

describe("getDoctorProfileStatus", () => {
  it("is present on success", async () => {
    serverApi.mockResolvedValue({ ok: true, status: 200, data: {} });

    expect(await getDoctorProfileStatus("en")).toBe("present");
    expect(serverApi).toHaveBeenCalledWith("doctors/me", { locale: "en" });
  });

  it.each([
    [404, "missing"],
    [401, "no-session"],
    [403, "forbidden"],
    [500, "unknown"],
    [0, "unknown"],
  ])("gives for status %i: %s", async (status, expected) => {
    serverApi.mockResolvedValue({
      ok: false,
      error: { status, fieldErrors: {} },
    });
    expect(await getDoctorProfileStatus("en")).toBe(expected);
  });
});
