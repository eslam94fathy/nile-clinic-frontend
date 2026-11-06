// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const callBackend = vi.hoisted(() => vi.fn());
const saveSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/server-api", () => ({ callBackend }));
vi.mock("@/lib/auth/session", () => ({ saveSession }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));

const TOKEN = "42|synthetic-sentinel-token";
const user = {
  id: 1,
  name: "Synthetic Person",
  email: "synthetic@example.test",
  role: "doctor",
  is_active: true,
  created_at: "2026-01-01T00:00:00+00:00",
  updated_at: "2026-01-01T00:00:00+00:00",
};

function request(
  body: unknown = { email: "synthetic@example.test", password: "synthetic" },
  headers: Record<string, string> = {},
) {
  return new Request("http://clinic.test/api/auth/sign-in", {
    method: "POST",
    headers: {
      host: "clinic.test",
      origin: "http://clinic.test",
      "accept-language": "ar",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function backendAnswers(status: number, body: unknown) {
  callBackend.mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

beforeEach(() => {
  callBackend.mockReset();
  saveSession.mockReset();
});

describe("POST /api/auth/sign-in", () => {
  it("seals the token and returns only the user", async () => {
    backendAnswers(200, {
      data: { token: TOKEN, token_type: "Bearer", user },
    });

    const response = await POST(request());
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(JSON.parse(text)).toEqual({ data: user });
    expect(text).not.toContain("sentinel");
    expect(saveSession).toHaveBeenCalledWith(TOKEN);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("passes the language on to the API", async () => {
    backendAnswers(200, { data: { token: TOKEN, user } });
    await POST(request());
    expect(callBackend.mock.calls[0]?.[1]?.locale).toBe("ar");
  });

  it("doesn't pass on an unsupported language", async () => {
    backendAnswers(200, { data: { token: TOKEN, user } });
    await POST(request(undefined, { "accept-language": "fr, en;q=0.5" }));
    expect(callBackend.mock.calls[0]?.[1]?.locale).toBeNull();
  });

  it("returns a refusal as the API sent it, with no cookie", async () => {
    const refusal = { message: "No.", errors: { email: ["No."] } };
    backendAnswers(422, refusal);

    const response = await POST(request());

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual(refusal);
    expect(saveSession).not.toHaveBeenCalled();
  });

  it.each([401, 403, 404, 500, 503, 302])(
    "gives a general failure for status %i",
    async (status) => {
      backendAnswers(status, { message: "internal detail" });

      const response = await POST(request());

      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({ message: "general" });
      expect(saveSession).not.toHaveBeenCalled();
    },
  );

  it("gives a general failure when no answer arrives", async () => {
    callBackend.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(502);
  });

  it.each([
    [{ data: { token: "", user } }],
    [{ data: { token: TOKEN } }],
    [{ data: { token: TOKEN, user: { id: 1 } } }],
    [{}],
  ])("sets no cookie for a success of the wrong shape: %j", async (body) => {
    backendAnswers(200, body);

    expect((await POST(request())).status).toBe(502);
    expect(saveSession).not.toHaveBeenCalled();
  });

  it.each([
    [{ email: "a" }],
    [{ password: "b" }],
    [{ email: 1, password: 2 }],
    ["not json"],
  ])("refuses the body %j without calling the API", async (body) => {
    const response = await POST(request(body));

    expect(response.status).toBe(422);
    expect(callBackend).not.toHaveBeenCalled();
  });

  it.each([[{ origin: "http://evil.test" }], [{ origin: "" }]])(
    "refuses a request from elsewhere: %j",
    async (headers) => {
      const response = await POST(request(undefined, headers));

      expect(response.status).toBe(403);
      expect(callBackend).not.toHaveBeenCalled();
    },
  );
});
