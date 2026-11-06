// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { getCurrentUser } from "./current-user";

const serverApi = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/server-api", () => ({ serverApi }));

const user = {
  id: 1,
  name: "Synthetic Person",
  email: "synthetic@example.test",
  role: "receptionist",
  is_active: true,
  created_at: "2026-01-01T00:00:00+00:00",
  updated_at: "2026-01-01T00:00:00+00:00",
};

describe("getCurrentUser", () => {
  it("gives the user", async () => {
    serverApi.mockResolvedValue({
      ok: true,
      status: 200,
      data: { data: user },
    });

    expect(await getCurrentUser("en")).toEqual({ kind: "signed-in", user });
    expect(serverApi).toHaveBeenCalledWith("auth/me", { locale: "en" });
  });

  it("treats 401 as no session", async () => {
    serverApi.mockResolvedValue({
      ok: false,
      error: { status: 401, fieldErrors: {} },
    });
    expect(await getCurrentUser("en")).toEqual({ kind: "no-session" });
  });

  it.each([0, 403, 404, 500, 503])(
    "keeps the session on status %i",
    async (status) => {
      serverApi.mockResolvedValue({
        ok: false,
        error: { status, fieldErrors: {} },
      });
      expect(await getCurrentUser("en")).toEqual({ kind: "unavailable" });
    },
  );

  it.each([
    [null],
    [{ data: { id: 1 } }],
    [{ data: { ...user, role: "patient" } }],
  ])("treats the wrong shape %j as unavailable", async (data) => {
    serverApi.mockResolvedValue({ ok: true, status: 200, data });
    expect(await getCurrentUser("en")).toEqual({ kind: "unavailable" });
  });
});
