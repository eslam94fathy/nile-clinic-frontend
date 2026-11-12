/**
 * Set by a medical-record page as it locks, so that reloading it, typing its address again, or opening a record in a new
 * tab shows only the lock (ADR 0020). Setting it sends nothing; the next request carries it. It holds no identity, ends
 * with the browser, and is cleared by every sign-in, unlock, and sign-out (`session.ts`).
 */
export const LOCK_COOKIE = "nile_locked";

/** Only in the browser. */
export function markLocked(): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LOCK_COOKIE}=1; Path=/; SameSite=Lax${secure}`;
}
