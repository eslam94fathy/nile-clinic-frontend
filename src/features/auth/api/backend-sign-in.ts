import "server-only";
import { callBackend } from "@/lib/api/server-api";
import { signedInSchema } from "../schemas/signed-in";
import type { StaffMember } from "../types";

export type BackendSignIn =
  | { kind: "signed-in"; token: string; user: StaffMember }
  /** The backend's 422 as sent: wrong password, deactivated, or throttled (gap G5). */
  | { kind: "refused"; body: unknown }
  /** No answer, or one that isn't a sign-in. */
  | { kind: "failed" };

/**
 * The one sign-in to the backend, shared by signing in and unlocking (ADR 0020). Only route handlers call it, as its
 * answer holds the raw token. Nothing here is logged.
 */
export async function signInToBackend(
  credentials: { email: string; password: string },
  locale: string | null,
): Promise<BackendSignIn> {
  const response = await callBackend("auth/sign-in", {
    method: "POST",
    locale,
    contentType: "application/json",
    body: JSON.stringify(credentials),
  });
  const body: unknown = await response?.json().catch(() => null);

  if (response?.status === 422) return { kind: "refused", body };
  if (response?.status !== 200) return { kind: "failed" };

  const signedIn = signedInSchema.safeParse(body);
  if (!signedIn.success) return { kind: "failed" };
  return { kind: "signed-in", ...signedIn.data.data };
}
