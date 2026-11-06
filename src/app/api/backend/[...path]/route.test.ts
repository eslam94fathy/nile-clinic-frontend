// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PATCH, POST, PUT } from "./route";

const callBackend = vi.hoisted(() => vi.fn());
const readSessionToken = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/server-api", () => ({ callBackend }));
vi.mock("@/lib/auth/session", () => ({ readSessionToken }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));

const ORIGIN = "http://clinic.test";

function request(
  path: string,
  method = "GET",
  headers: Record<string, string> = {},
  body?: string,
) {
  return new NextRequest(`${ORIGIN}/api/backend/${path}`, {
    method,
    headers: {
      host: "clinic.test",
      origin: ORIGIN,
      accept: "application/json",
      ...headers,
    },
    ...(body ? { body } : {}),
  });
}

function backendAnswers(
  status: number,
  body: string | null,
  headers: Record<string, string> = { "content-type": "application/json" },
) {
  callBackend.mockResolvedValue(new Response(body, { status, headers }));
}

beforeEach(() => {
  callBackend.mockReset();
  readSessionToken.mockReset();
  readSessionToken.mockResolvedValue("synthetic-token");
});

describe("what it refuses, with no call to the API", () => {
  it.each([
    "auth/sign-in",
    "AUTH/SIGN-IN",
    "auth/sign%2Din",
    "auth/sign-out",
    "staff%2F..%2Fsecret",
    "staff%5Csecret",
    "staff//x",
    "staff%0d%0ax",
    "%E0%A4%A",
  ])("the path %s", async (path) => {
    const response = await POST(request(path, "POST"));

    expect(response.status).toBe(404);
    expect(callBackend).not.toHaveBeenCalled();
  });

  it.each([
    ["POST", POST],
    ["PUT", PUT],
    ["PATCH", PATCH],
    ["DELETE", DELETE],
  ] as const)("%s from another site", async (method, handler) => {
    const response = await handler(
      request("staff", method, { origin: "http://evil.test" }),
    );

    expect(response.status).toBe(403);
    expect(callBackend).not.toHaveBeenCalled();
  });

  it("a state-changing request with no origin", async () => {
    const plain = new NextRequest(`${ORIGIN}/api/backend/staff`, {
      method: "POST",
      headers: { host: "clinic.test" },
    });

    expect((await POST(plain)).status).toBe(403);
    expect(callBackend).not.toHaveBeenCalled();
  });

  it.each([
    ["a link opened from elsewhere", "text/html,application/xhtml+xml,*/*"],
    ["anything", "*/*"],
  ])("a read that doesn't ask for JSON: %s", async (_label, accept) => {
    const response = await GET(request("patients/123", "GET", { accept }));

    expect(response.status).toBe(406);
    expect(callBackend).not.toHaveBeenCalled();
  });

  it("a request with no session", async () => {
    readSessionToken.mockResolvedValue(null);

    const response = await GET(request("staff"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: "noSession" });
    expect(callBackend).not.toHaveBeenCalled();
  });
});

describe("what it forwards", () => {
  it("the path, query, method, body, token, and language", async () => {
    backendAnswers(200, "{}");

    await PATCH(
      request(
        "staff/5?role=doctor&page=2",
        "PATCH",
        {
          "accept-language": "ar",
          "content-type": "application/json",
          cookie: "nile_session=secret; other=1",
          "x-custom": "not forwarded",
        },
        '{"a":1}',
      ),
    );

    const [path, options] = callBackend.mock.calls[0] ?? [];
    expect(path).toBe("staff/5?role=doctor&page=2");
    expect(options.method).toBe("PATCH");
    expect(options.locale).toBe("ar");
    expect(options.token).toBe("synthetic-token");
    expect(options.contentType).toBe("application/json");
    expect(new TextDecoder().decode(options.body)).toBe('{"a":1}');
    // callBackend builds the outgoing headers from these options alone, so nothing else can pass.
    expect(Object.keys(options).sort()).toEqual([
      "body",
      "contentType",
      "locale",
      "method",
      "token",
    ]);
  });

  it("no body on a read", async () => {
    backendAnswers(200, "{}");
    await GET(request("staff"));

    const options = callBackend.mock.calls[0]?.[1];
    expect(options.body).toBeNull();
    expect(options.contentType).toBeNull();
  });

  it("no unsupported language", async () => {
    backendAnswers(200, "{}");
    await GET(request("staff", "GET", { "accept-language": "ar, en;q=0.5" }));
    expect(callBackend.mock.calls[0]?.[1]?.locale).toBeNull();
  });
});

describe("what it returns", () => {
  it.each([400, 401, 403, 404, 409, 422, 500])(
    "status %i and body as sent",
    async (status) => {
      const body = { message: "Sent.", errors: { a: ["b"] } };
      backendAnswers(status, JSON.stringify(body));

      const response = await GET(request("staff"));

      expect(response.status).toBe(status);
      expect(await response.json()).toEqual(body);
    },
  );

  it("no page links, which hold the private address", async () => {
    backendAnswers(
      200,
      JSON.stringify({
        data: [],
        links: { next: "http://private.test/staff" },
        meta: {
          total: 1,
          path: "http://private.test/staff",
          links: [{ url: "http://private.test/staff" }],
        },
      }),
    );

    const response = await GET(request("staff"));
    const text = await response.text();

    expect(text).not.toContain("private.test");
    expect(JSON.parse(text)).toEqual({ data: [], meta: { total: 1 } });
  });

  it("only its own headers, with no-store", async () => {
    backendAnswers(200, "{}", {
      "content-type": "application/json",
      "set-cookie": "laravel=secret",
      server: "nginx",
    });

    const response = await GET(request("staff"));

    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("server")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("an empty 204", async () => {
    backendAnswers(204, null, {});

    const response = await PUT(request("auth/password", "PUT"));

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  it("502, not the page, for a body that isn't JSON", async () => {
    backendAnswers(504, "<html>nginx at private.test</html>", {
      "content-type": "text/html",
    });

    const response = await GET(request("staff"));

    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("private.test");
  });

  it("502 for malformed JSON", async () => {
    backendAnswers(200, "{oops");
    expect((await GET(request("staff"))).status).toBe(502);
  });

  it("502, not an exception, when the body fails partway", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.error(new Error("connection dropped"));
      },
    });
    callBackend.mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    expect((await GET(request("staff"))).status).toBe(502);
  });

  it("502 when no answer arrives", async () => {
    callBackend.mockResolvedValue(null);
    expect((await GET(request("staff"))).status).toBe(502);
  });

  it("502, without the address, for a redirect", async () => {
    backendAnswers(302, null, { location: "http://private.test/elsewhere" });

    const response = await GET(request("staff"));

    expect(response.status).toBe(502);
    expect(response.headers.get("location")).toBeNull();
    expect(await response.text()).not.toContain("private.test");
  });
});
