import { decodeSafeSegments } from "./path-segments";

// Tokens must only come from the auth routes, which seal them. Sign-out has to clear the cookie as well.
const REFUSED = new Set(["auth/sign-in", "auth/sign-out"]);

/**
 * Checks the path after `/api/backend/`, as the browser sent it. Returns it unchanged if it may be
 * forwarded, or null if not. It stays percent-encoded, so that a checked segment can't change meaning.
 */
export function checkBackendPath(raw: string): string | null {
  const decoded = decodeSafeSegments(raw.split("/"));
  if (!decoded) return null;

  return REFUSED.has(decoded.join("/").toLowerCase()) ? null : raw;
}
