// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sealData } from "iron-session";
import {
  destroySession,
  isLockMarked,
  readSessionIdentity,
  readSessionToken,
  saveSession,
} from "./session";

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
  getEnv: () => ({ SESSION_SECRET: SECRET }),
}));

const TOKEN = "42|synthetic-token-value";
const SECRET = "synthetic-session-secret-for-unit-tests";
const PERSON = { id: 7, email: "synthetic.doctor@example.test" };

beforeEach(() => jar.clear());

describe("the session", () => {
  it("reads back what it saved", async () => {
    await saveSession(TOKEN, PERSON);
    expect(await readSessionToken()).toBe(TOKEN);
  });

  it("seals the token, so the cookie's value doesn't hold it", async () => {
    await saveSession(TOKEN, PERSON);
    const { value } = jar.get("nile_session") ?? { value: "" };

    expect(value.length).toBeGreaterThan(0);
    expect(value).not.toContain("synthetic-token-value");
    expect(Buffer.from(value, "base64").toString()).not.toContain(
      "synthetic-token-value",
    );
  });

  it("sets a cookie scripts can't read, which ends with the browser", async () => {
    await saveSession(TOKEN, PERSON);
    const cookie = jar.get("nile_session");

    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.path).toBe("/");
    expect(cookie?.maxAge).toBeUndefined();
    expect(cookie?.expires).toBeUndefined();
  });

  it("is Secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await saveSession(TOKEN, PERSON);
    expect(jar.get("nile_session")?.secure).toBe(true);
  });

  it("seals who signed in, for unlocking, and reads it back", async () => {
    await saveSession(TOKEN, PERSON);

    expect(await readSessionIdentity()).toEqual({
      token: TOKEN,
      userId: 7,
      email: "synthetic.doctor@example.test",
    });
    const { value } = jar.get("nile_session") ?? { value: "" };
    expect(value).not.toContain("synthetic.doctor");
  });

  it("has no identity without a cookie, or with a tampered one", async () => {
    expect(await readSessionIdentity()).toBeNull();

    await saveSession(TOKEN, PERSON);
    const cookie = jar.get("nile_session");
    if (cookie) cookie.value = `${cookie.value.slice(0, -4)}AAAA`;
    expect(await readSessionIdentity()).toBeNull();
  });

  it("keeps a seal made before the identity was added working, but it can't unlock", async () => {
    store.set(
      "nile_session",
      await sealData({ token: TOKEN }, { password: SECRET }),
    );

    expect(await readSessionToken()).toBe(TOKEN);
    expect(await readSessionIdentity()).toBeNull();
  });

  it("has no session without a cookie", async () => {
    expect(await readSessionToken()).toBeNull();
  });

  it("treats a tampered cookie as no session", async () => {
    await saveSession(TOKEN, PERSON);
    const cookie = jar.get("nile_session");
    if (cookie) cookie.value = `${cookie.value.slice(0, -4)}AAAA`;

    expect(await readSessionToken()).toBeNull();
  });

  it("treats garbage as no session", async () => {
    store.set("nile_session", "not-a-seal");
    expect(await readSessionToken()).toBeNull();
  });

  it("clears the session", async () => {
    await saveSession(TOKEN, PERSON);
    await destroySession();
    expect(await readSessionToken()).toBeNull();
  });
});

describe("the lock marker (ADR 0020)", () => {
  const markLocked = () => store.set("nile_locked", "1", { path: "/" });

  it("reads whether a page in this browser locked", async () => {
    expect(await isLockMarked()).toBe(false);
    markLocked();
    expect(await isLockMarked()).toBe(true);
  });

  it("is cleared by a fresh session, from a sign-in or an unlock", async () => {
    markLocked();
    await saveSession(TOKEN, PERSON);

    expect(await isLockMarked()).toBe(false);
    expect(jar.get("nile_locked")).toMatchObject({ path: "/", maxAge: 0 });
  });

  it("is cleared by signing out", async () => {
    markLocked();
    await destroySession();

    expect(await isLockMarked()).toBe(false);
  });
});
