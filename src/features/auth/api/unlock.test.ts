import { afterEach, describe, expect, it, vi } from "vitest";
import { unlock } from "./unlock";

const fetchMock = vi.fn<typeof fetch>();

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("unlock", () => {
  it("posts the password and whose page it is, in the page's language", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      Response.json({ data: { id: 3 } }, { status: 200 }),
    );

    const result = await unlock("synthetic-typed-password", 3, "ar");

    expect(result).toEqual({
      ok: true,
      status: 200,
      data: { data: { id: 3 } },
    });
    const [address, init] = fetchMock.mock.calls[0] ?? [];
    expect(address).toBe("/api/auth/unlock");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Accept-Language")).toBe("ar");
    expect(new Headers(init?.headers).get("Content-Type")).toBe(
      "application/json",
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      password: "synthetic-typed-password",
      userId: 3,
    });
  });

  it("gives the refusal as sent", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      Response.json(
        { message: "Wrong.", errors: { email: ["Wrong."] } },
        { status: 422 },
      ),
    );

    expect(await unlock("x", 3, "en")).toEqual({
      ok: false,
      error: {
        status: 422,
        message: "Wrong.",
        fieldErrors: { email: ["Wrong."] },
      },
    });
  });

  it("says no answer arrived when the application can't be reached", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    expect(await unlock("x", 3, "en")).toEqual({
      ok: false,
      error: { status: 0, fieldErrors: {} },
    });
  });
});
