// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const callBackend = vi.hoisted(() => vi.fn());
const readSessionIdentity = vi.hoisted(() => vi.fn());
const saveSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/server-api", () => ({ callBackend }));
vi.mock("@/lib/auth/session", () => ({ readSessionIdentity, saveSession }));
vi.mock("next-intl/server", () => ({
  getTranslations:
    async ({ namespace }: { namespace: string }) =>
    (key: string) =>
      `${namespace}.${key}`,
}));

const OLD_TOKEN = "41|synthetic-old-token";
const NEW_TOKEN = "42|synthetic-new-token";
const PASSWORD = "synthetic-typed-password";
const SEALED = {
  token: OLD_TOKEN,
  userId: 3,
  email: "synthetic.doctor@example.test",
};
const user = (id: number, email = SEALED.email) => ({
  id,
  name: "Synthetic Doctor",
  email,
  role: "doctor",
  is_active: true,
  created_at: "2026-01-01T00:00:00+00:00",
  updated_at: "2026-01-01T00:00:00+00:00",
});

function request(
  body: unknown = { password: PASSWORD, userId: 3 },
  headers: Record<string, string> = {},
) {
  return new Request("http://clinic.test/api/auth/unlock", {
    method: "POST",
    headers: {
      host: "clinic.test",
      origin: "http://clinic.test",
      "accept-language": "en",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const answer = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });
const signedIn = (id: number, email?: string) =>
  answer(200, {
    data: { token: NEW_TOKEN, token_type: "Bearer", user: user(id, email) },
  });

/** Every call the route made to the backend, as [path, options]. */
const calls = () =>
  callBackend.mock.calls as [string, Record<string, unknown>][];

/** Reads the answer once, checking that nothing secret is in it and that it isn't stored. */
async function read(response: Response): Promise<unknown> {
  const text = await response.text();
  expect(text).not.toContain(PASSWORD);
  expect(text).not.toContain("synthetic-old-token");
  expect(text).not.toContain("synthetic-new-token");
  expect(response.headers.get("cache-control")).toBe("no-store");
  return JSON.parse(text);
}

beforeEach(() => {
  callBackend.mockReset();
  readSessionIdentity.mockReset().mockResolvedValue(SEALED);
  saveSession.mockReset();
});

describe("POST /api/auth/unlock", () => {
  it("refuses a request from another site, or with no origin", async () => {
    for (const headers of [
      { origin: "https://elsewhere.example" },
      { origin: "" },
    ]) {
      const response = await POST(request(undefined, headers));
      expect(response.status).toBe(403);
      expect(await read(response)).toEqual({
        message: "auth.errors.refused",
      });
    }
    expect(callBackend).not.toHaveBeenCalled();
  });

  it("asks for a password when none, or an empty one, is sent", async () => {
    for (const body of [
      {},
      { password: "", userId: 3 },
      { password: 7, userId: 3 },
      "not json",
    ]) {
      const response = await POST(request(body));
      expect(response.status).toBe(422);
      expect(await read(response)).toEqual({
        message: "auth.errors.passwordRequired",
        errors: { password: ["auth.errors.passwordRequired"] },
      });
    }
    expect(callBackend).not.toHaveBeenCalled();
  });

  it("can't unlock a seal that doesn't say who signed in", async () => {
    readSessionIdentity.mockResolvedValue(null);

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(await read(response)).toEqual({
      message: "auth.lock.cannotUnlock",
    });
    expect(callBackend).not.toHaveBeenCalled();
    expect(saveSession).not.toHaveBeenCalled();
  });

  it("refuses when someone else has signed in since, in another tab, without trying their password", async () => {
    // The page was opened for person 3; the cookie now names person 9.
    readSessionIdentity.mockResolvedValue({ ...SEALED, userId: 9 });

    for (const body of [
      { password: PASSWORD, userId: 3 },
      // A page that doesn't say whose it is can't be opened either.
      { password: PASSWORD },
    ]) {
      const response = await POST(request(body));

      expect(response.status).toBe(body.userId ? 409 : 422);
    }
    expect(callBackend).not.toHaveBeenCalled();
    expect(saveSession).not.toHaveBeenCalled();
  });

  it("signs in with the sealed email, never one sent by the browser", async () => {
    callBackend.mockResolvedValueOnce(signedIn(3));
    callBackend.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await POST(
      request({
        password: PASSWORD,
        userId: 3,
        email: "someone.else@example.test",
      }),
    );

    const [path, options] = calls()[0] ?? [];
    expect(path).toBe("auth/sign-in");
    expect(options).toMatchObject({
      method: "POST",
      locale: "en",
      contentType: "application/json",
    });
    expect(JSON.parse(String(options?.body))).toEqual({
      email: SEALED.email,
      password: PASSWORD,
    });
  });

  it("passes the backend's refusal through, and changes nothing", async () => {
    const refusal = {
      message: "These credentials do not match our records.",
      errors: { email: ["These credentials do not match our records."] },
    };
    callBackend.mockResolvedValueOnce(answer(422, refusal));

    const response = await POST(request());

    expect(response.status).toBe(422);
    expect(await read(response)).toEqual(refusal);
    expect(calls()).toHaveLength(1);
    expect(saveSession).not.toHaveBeenCalled();
  });

  it("refuses another account, ending the token it was just given", async () => {
    callBackend.mockResolvedValueOnce(signedIn(9, "reassigned@example.test"));
    callBackend.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(await read(response)).toEqual({
      message: "auth.lock.otherAccount",
    });
    expect(calls()[1]).toEqual([
      "auth/sign-out",
      { method: "POST", locale: "en", token: NEW_TOKEN },
    ]);
    expect(calls()).toHaveLength(2);
    expect(saveSession).not.toHaveBeenCalled();
  });

  it("ends the old token, seals the new one, and answers with the person", async () => {
    callBackend.mockResolvedValueOnce(signedIn(3, "renamed@example.test"));
    callBackend.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await read(response)).toEqual({
      data: user(3, "renamed@example.test"),
    });
    expect(calls()[1]).toEqual([
      "auth/sign-out",
      { method: "POST", locale: "en", token: OLD_TOKEN },
    ]);
    expect(saveSession).toHaveBeenCalledWith(NEW_TOKEN, {
      id: 3,
      email: "renamed@example.test",
    });
  });

  it("still unlocks when the old token has already expired or gone", async () => {
    callBackend.mockResolvedValueOnce(signedIn(3));
    callBackend.mockResolvedValueOnce(
      answer(401, { message: "Unauthenticated." }),
    );

    const expired = await POST(request());
    expect(expired.status).toBe(200);
    expect(saveSession).toHaveBeenCalledTimes(1);

    readSessionIdentity.mockResolvedValue({ ...SEALED, token: null });
    callBackend.mockReset().mockResolvedValueOnce(signedIn(3));

    const gone = await POST(request());
    expect(gone.status).toBe(200);
    expect(calls()).toHaveLength(1);
    expect(saveSession).toHaveBeenCalledTimes(2);
  });

  it("answers a general failure when the backend can't be read, and changes nothing", async () => {
    for (const reply of [
      null,
      answer(500, { message: "Server Error" }),
      answer(200, { data: { user: user(3) } }),
      new Response("not json", { status: 200 }),
    ]) {
      callBackend.mockReset().mockResolvedValueOnce(reply);

      const response = await POST(request());

      expect(response.status).toBe(502);
      expect(await read(response)).toEqual({
        message: "auth.errors.general",
      });
      expect(saveSession).not.toHaveBeenCalled();
    }
  });
});
