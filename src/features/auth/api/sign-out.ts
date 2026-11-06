/** False only when the application's own server can't be reached, as the cookie then can't be cleared. */
export async function signOut(): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/sign-out", { method: "POST" });
    return response.ok;
  } catch {
    return false;
  }
}
