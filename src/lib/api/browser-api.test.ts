import { beforeEach, describe, expect, it, vi } from "vitest";
import { browserApi } from "./browser-api";

const endSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session-end", () => ({ endSession }));

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  endSession.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

describe("browserApi", () => {
  it("answers a 401 when asked to, without ending the session", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "Signed out." }), { status: 401 }),
    );

    const result = await browserApi("x", {
      locale: "en",
      answerSessionEnd: true,
    });

    expect(endSession).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      error: { status: 401, message: "Signed out.", fieldErrors: {} },
    });
  });

  it("calls the same-origin route with the language", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const result = await browserApi("auth/password", {
      method: "PUT",
      json: { a: 1 },
      locale: "ar",
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/backend/auth/password");
    expect(init?.method).toBe("PUT");
    expect(init?.body).toBe('{"a":1}');
    expect(new Headers(init?.headers).get("accept-language")).toBe("ar");
    expect(result).toEqual({ ok: true, status: 204, data: null });
  });

  it("returns the API's error", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "No." }), { status: 403 }),
    );

    expect(await browserApi("x", { locale: "en" })).toEqual({
      ok: false,
      error: { status: 403, message: "No.", fieldErrors: {} },
    });
    expect(endSession).not.toHaveBeenCalled();
  });

  it("reports no answer as status 0, and doesn't retry", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    expect(await browserApi("x", { method: "POST", locale: "en" })).toEqual({
      ok: false,
      error: { status: 0, fieldErrors: {} },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ends the session on 401, and never settles", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 401 }));

    const outcome = await Promise.race([
      browserApi("x", { locale: "en" }),
      new Promise((resolve) => setTimeout(() => resolve("pending"), 20)),
    ]);

    expect(outcome).toBe("pending");
    expect(endSession).toHaveBeenCalledTimes(1);
  });
});
