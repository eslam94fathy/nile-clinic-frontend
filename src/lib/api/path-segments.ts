const CONTROL_CHARACTER = /\p{Cc}/u;

/**
 * Decodes an address's segments, or returns null if any is unsafe once decoded: malformed, empty, a dot
 * segment, or holding a slash, backslash, or control character. Used wherever an address from outside
 * decides where something goes.
 */
export function decodeSafeSegments(segments: string[]): string[] | null {
  const decoded: string[] = [];

  for (const segment of segments) {
    let value: string;
    try {
      value = decodeURIComponent(segment);
    } catch {
      return null;
    }
    if (
      value === "" ||
      value === "." ||
      value === ".." ||
      value.includes("/") ||
      value.includes("\\") ||
      CONTROL_CHARACTER.test(value)
    ) {
      return null;
    }
    decoded.push(value);
  }

  return decoded;
}
