import "server-only";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/config/env";
import { SESSION_COOKIE } from "./session-cookie";

// The role and name are read from the API on each request, so they can't go stale here.
type SessionData = { token?: string };

async function openSession() {
  return getIronSession<SessionData>(await cookies(), {
    password: getEnv().SESSION_SECRET,
    cookieName: SESSION_COOKIE,
    cookieOptions: {
      // No expiry: the cookie ends with the browser, and the seal never expires by itself, because the
      // API's idle limit decides when a session ends (FR-004, research R7).
      maxAge: undefined,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  });
}

/** Absent, tampered with, or sealed with an old secret all read as no session. */
export async function readSessionToken(): Promise<string | null> {
  return (await openSession()).token ?? null;
}

/** Only in route handlers: a Server Component can't change cookies. */
export async function saveSession(token: string): Promise<void> {
  const session = await openSession();
  session.token = token;
  await session.save();
}

/** Only in route handlers: a Server Component can't change cookies. */
export async function destroySession(): Promise<void> {
  (await openSession()).destroy();
}
