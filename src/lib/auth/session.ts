import "server-only";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/config/env";
import { LOCK_COOKIE } from "./lock-marker";
import { SESSION_COOKIE } from "./session-cookie";

// The role and name are read from the API on each request, so they can't go stale here. The id and email are
// only for unlocking a locked page: they name the one account it may sign in again (ADR 0020).
type SessionData = { token?: string; userId?: number; email?: string };

/** Who signed in, for unlocking. The token may already have expired, which unlocking doesn't need. */
export type SessionIdentity = {
  token: string | null;
  userId: number;
  email: string;
};

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

/**
 * A seal made before the identity was added still works, but can't unlock, so the lock offers only signing out.
 */
export async function readSessionIdentity(): Promise<SessionIdentity | null> {
  const { token, userId, email } = await openSession();
  if (typeof userId !== "number" || typeof email !== "string") return null;
  return { token: token ?? null, userId, email };
}

/** Whether a medical-record page in this browser locked and hasn't been unlocked since (ADR 0020). */
export async function isLockMarked(): Promise<boolean> {
  return (await cookies()).get(LOCK_COOKIE)?.value === "1";
}

async function clearLockMarker() {
  const jar = await cookies();
  if (jar.get(LOCK_COOKIE)) jar.set(LOCK_COOKIE, "", { path: "/", maxAge: 0 });
}

/** Only in route handlers: a Server Component can't change cookies. A fresh session opens any locked page. */
export async function saveSession(
  token: string,
  user: { id: number; email: string },
): Promise<void> {
  const session = await openSession();
  session.token = token;
  session.userId = user.id;
  session.email = user.email;
  await session.save();
  await clearLockMarker();
}

/** Only in route handlers: a Server Component can't change cookies. */
export async function destroySession(): Promise<void> {
  (await openSession()).destroy();
  await clearLockMarker();
}
