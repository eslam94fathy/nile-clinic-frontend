/**
 * With `SameSite=Lax`, this is the defense against requests from other sites. A missing `Origin` is
 * refused, because browsers send it on every state-changing request.
 */
export function isSameOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  const host = headers.get("host");
  if (!origin || !host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function isStateChanging(method: string): boolean {
  return method !== "GET" && method !== "HEAD";
}
