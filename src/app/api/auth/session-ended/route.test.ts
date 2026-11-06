// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const getCurrentUser = vi.hoisted(() => vi.fn());
const destroySession = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/api/current-user", () => ({ getCurrentUser }));
vi.mock("@/lib/auth/session", () => ({ destroySession }));

const call = (query: string) =>
  GET(
    new NextRequest(`http://clinic.test/api/auth/session-ended?${query}`, {
      headers: { cookie: "nile_session=sealed-value" },
    }),
  );

beforeEach(() => {
  destroySession.mockReset();
  getCurrentUser.mockReset();
  getCurrentUser.mockResolvedValue({ kind: "no-session" });
});

describe("GET /api/auth/session-ended", () => {
  it("clears the cookie and goes to sign-in with the message", async () => {
    const response = await call("locale=en");

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/en/sign-in?ended=1");
    expect(destroySession).toHaveBeenCalledTimes(1);
  });

  it("says nothing about a session to someone who never had one", async () => {
    const response = await GET(
      new NextRequest(
        "http://clinic.test/api/auth/session-ended?locale=en&return=%2Fqueue",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "/en/sign-in?return=%2Fqueue",
    );
  });

  it("keeps a safe return address, without its language", async () => {
    const response = await call("locale=ar&return=%2Far%2Fqueue");

    expect(response.headers.get("location")).toBe(
      "/ar/sign-in?ended=1&return=%2Fqueue",
    );
  });

  it.each(["%2Fpatients%2F5", "%2F%2Fevil.test", "https%3A%2F%2Fevil.test"])(
    "drops the return address %s",
    async (value) => {
      const response = await call(`locale=en&return=${value}`);
      expect(response.headers.get("location")).toBe("/en/sign-in?ended=1");
    },
  );

  it.each(["fr", "", "en/../evil"])(
    "uses the default language for %j",
    async (locale) => {
      const response = await call(`locale=${locale}`);
      expect(response.headers.get("location")).toMatch(/^\/ar\/sign-in/);
    },
  );

  it.each(["signed-in", "unavailable"])(
    "leaves the session alone when the API says %s",
    async (kind) => {
      getCurrentUser.mockResolvedValue({ kind });

      const response = await call("locale=en");

      expect(response.headers.get("location")).toBe("/en/dashboard");
      expect(destroySession).not.toHaveBeenCalled();
    },
  );
});
