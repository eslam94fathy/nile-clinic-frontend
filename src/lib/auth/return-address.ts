import { decodeSafeSegments } from "@/lib/api/path-segments";
import { routing } from "@/lib/i18n/routing";

const CONTROL_CHARACTER = /\p{Cc}/u;
const NEVER_RETURN_TO = new Set([
  "sign-in",
  "address-not-found",
  "api",
  "_next",
]);

/**
 * Pages that write a permanent audit entry when opened. Returning someone to one after sign-in could
 * record a false "opened" entry against whoever signs in next on a shared computer (FR-014).
 */
function opensAuditedRecord(segments: string[]): boolean {
  const [first, second, third] = segments.map((part) => part.toLowerCase());

  if (first === "audit") return true;
  if (first === "patients") return second !== undefined;
  if (first === "my" && (second === "encounters" || second === "patients")) {
    return third !== undefined;
  }
  return false;
}

/**
 * Treats its input as untrusted, as it comes from an address. Returns a path with no language, query, or
 * fragment, or null, which means the landing page.
 */
export function safeReturnAddress(
  raw: string | null | undefined,
): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  if (raw.includes("\\") || CONTROL_CHARACTER.test(raw)) return null;

  const path = raw.split(/[?#]/, 1)[0] ?? "";
  const encoded = path.slice(1).split("/");
  if (routing.locales.some((locale) => locale === encoded[0])) encoded.shift();

  const segments = decodeSafeSegments(encoded);
  if (!segments) return null;

  const first = segments[0]?.toLowerCase();
  if (first === undefined || NEVER_RETURN_TO.has(first)) return null;
  if (opensAuditedRecord(segments)) return null;

  return `/${encoded.join("/")}`;
}
