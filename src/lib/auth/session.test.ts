// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { destroySession, readSessionToken, saveSession } from "./session";

type Cookie = { name: string; value: string; [option: string]: unknown };

const jar = new Map<string, Cookie>();
const store = {
  get: (name: string) => jar.get(name),
  set: (nameOrCookie: string | Cookie, value?: string, options?: object) => {
    const cookie =
      typeof nameOrCookie === "string"
        ? { name: nameOrCookie, value: value ?? "", ...options }
        : nameOrCookie;
    jar.set(cookie.name, cookie);
  },
};

vi.mock("next/headers", () => ({ cookies: async () => store }));
vi.mock("@/lib/config/env", () => ({
  getEnv: () => ({ SESSION_SECRET: "synthetic-session-secret-for-unit-tests" }),
}));

const TOKEN = "42|synthetic-token-value";

beforeEach(() => jar.clear());

describe("the session", () => {
  it("reads back what it saved", async () => {
    await saveSession(TOKEN);
    expect(await readSessionToken()).toBe(TOKEN);
  });

  it("seals the token, so the cookie's value doesn't hold it", async () => {
    await saveSession(TOKEN);
    const { value } = jar.get("nile_session") ?? { value: "" };

    expect(value.length).toBeGreaterThan(0);
    expect(value).not.toContain("synthetic-token-value");
    expect(Buffer.from(value, "base64").toString()).not.toContain(
      "synthetic-token-value",
    );
  });

  it("sets a cookie scripts can't read, which ends with the browser", async () => {
    await saveSession(TOKEN);
    const cookie = jar.get("nile_session");

    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.path).toBe("/");
    expect(cookie?.maxAge).toBeUndefined();
    expect(cookie?.expires).toBeUndefined();
  });

  it("is Secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await saveSession(TOKEN);
    expect(jar.get("nile_session")?.secure).toBe(true);
  });

  it("has no session without a cookie", async () => {
    expect(await readSessionToken()).toBeNull();
  });

  it("treats a tampered cookie as no session", async () => {
    await saveSession(TOKEN);
    const cookie = jar.get("nile_session");
    if (cookie) cookie.value = `${cookie.value.slice(0, -4)}AAAA`;

    expect(await readSessionToken()).toBeNull();
  });

  it("treats garbage as no session", async () => {
    store.set("nile_session", "not-a-seal");
    expect(await readSessionToken()).toBeNull();
  });

  it("clears the session", async () => {
    await saveSession(TOKEN);
    await destroySession();
    expect(await readSessionToken()).toBeNull();
  });
});
