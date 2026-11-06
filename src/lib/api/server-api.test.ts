// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callBackend, serverApi } from "./server-api";

const connection = vi.hoisted(() => vi.fn(async () => undefined));
const readSessionToken = vi.hoisted(() =>
  vi.fn(async (): Promise<string | null> => "synthetic-token"),
);

vi.mock("next/server", () => ({ connection }));
vi.mock("@/lib/auth/session", () => ({ readSessionToken }));
vi.mock("@/lib/config/env", () => ({
  getEnv: () => ({ BACKEND_API_URL: "http://api.test/api/v1" }),
}));

const fetchMock = vi.fn<typeof fetch>();

function respond(status: number, body: unknown) {
  fetchMock.mockResolvedValue(
    new Response(body === null ? null : JSON.stringify(body), { status }),
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  connection.mockClear();
  readSessionToken.mockResolvedValue("synthetic-token");
  vi.stubGlobal("fetch", fetchMock);
});

describe("serverApi", () => {
  it("waits for a real request before reading the session", async () => {
    respond(200, { data: 1 });
    await serverApi("auth/me", { locale: "ar" });

    expect(connection.mock.invocationCallOrder[0]).toBeLessThan(
      readSessionToken.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("sends the token and language, uncached, and doesn't follow redirects", async () => {
    respond(200, { data: 1 });
    await serverApi("auth/me", { locale: "ar" });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(url).toBe("http://api.test/api/v1/auth/me");
    expect(headers.get("authorization")).toBe("Bearer synthetic-token");
    expect(headers.get("accept-language")).toBe("ar");
    expect(headers.get("accept")).toBe("application/json");
    expect(init?.cache).toBe("no-store");
    expect(init?.redirect).toBe("manual");
  });

  it("returns the body on success", async () => {
    respond(200, { data: 1 });
    expect(await serverApi("x", { locale: "en" })).toEqual({
      ok: true,
      status: 200,
      data: { data: 1 },
    });
  });

  it("makes no call without a session", async () => {
    readSessionToken.mockResolvedValue(null);

    expect(await serverApi("x", { locale: "en" })).toEqual({
      ok: false,
      error: { status: 401, fieldErrors: {} },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns an API failure", async () => {
    respond(403, { message: "No." });
    expect(await serverApi("x", { locale: "en" })).toEqual({
      ok: false,
      error: { status: 403, message: "No.", fieldErrors: {} },
    });
  });

  it("treats a redirect as a failure", async () => {
    respond(302, null);
    const result = await serverApi("x", { locale: "en" });
    expect(!result.ok && result.error.status).toBe(302);
  });

  it("reports no answer as status 0", async () => {
    fetchMock.mockRejectedValue(new Error("refused"));
    expect(await serverApi("x", { locale: "en" })).toEqual({
      ok: false,
      error: { status: 0, fieldErrors: {} },
    });
  });
});

describe("callBackend", () => {
  it("returns null when no answer arrives", async () => {
    fetchMock.mockRejectedValue(new Error("refused"));
    expect(await callBackend("x")).toBeNull();
  });

  it("sends no token or language unless given", async () => {
    respond(200, {});
    await callBackend("x");

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("accept-language")).toBeNull();
  });
});
