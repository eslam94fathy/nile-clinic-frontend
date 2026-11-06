// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const callBackend = vi.hoisted(() => vi.fn());
const readSessionToken = vi.hoisted(() => vi.fn());
const destroySession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/server-api", () => ({ callBackend }));
vi.mock("@/lib/auth/session", () => ({ readSessionToken, destroySession }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));

function request(origin = "http://clinic.test") {
  return new Request("http://clinic.test/api/auth/sign-out", {
    method: "POST",
    headers: { host: "clinic.test", origin },
  });
}

beforeEach(() => {
  callBackend.mockReset();
  destroySession.mockReset();
  readSessionToken.mockReset();
  readSessionToken.mockResolvedValue("synthetic-token");
});

describe("POST /api/auth/sign-out", () => {
  it("ends the token, then clears the cookie", async () => {
    callBackend.mockResolvedValue(new Response(null, { status: 204 }));

    const response = await POST(request());

    expect(response.status).toBe(204);
    expect(callBackend.mock.calls[0]?.[0]).toBe("auth/sign-out");
    expect(callBackend.mock.calls[0]?.[1]?.token).toBe("synthetic-token");
    expect(destroySession).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["no answer", null],
    ["a failure", new Response("{}", { status: 500 })],
    ["an expired token", new Response("{}", { status: 401 })],
  ])("still clears the cookie after %s", async (_label, answer) => {
    callBackend.mockResolvedValue(answer);

    const response = await POST(request());

    expect(response.status).toBe(204);
    expect(destroySession).toHaveBeenCalledTimes(1);
  });

  it("makes no API call without a session", async () => {
    readSessionToken.mockResolvedValue(null);

    expect((await POST(request())).status).toBe(204);
    expect(callBackend).not.toHaveBeenCalled();
  });

  it("refuses another site, keeping the session", async () => {
    const response = await POST(request("http://evil.test"));

    expect(response.status).toBe(403);
    expect(callBackend).not.toHaveBeenCalled();
    expect(destroySession).not.toHaveBeenCalled();
  });
});
