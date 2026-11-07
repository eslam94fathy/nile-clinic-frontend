import type { ApiError } from "@/lib/api/api-error";

const LINE_KEY = /^prescriptions\.(\d+)\.(.+)$/;

/**
 * The API counts the lines it was sent, and lines with nothing in them aren't sent, so its numbers can differ
 * from those on screen. A key that can't be matched stays as it is, and so goes to the form level, not nowhere.
 */
export function withScreenLines(
  error: ApiError,
  sentLines: readonly number[],
): ApiError {
  const fieldErrors: Record<string, string[]> = {};

  for (const [key, messages] of Object.entries(error.fieldErrors)) {
    const match = LINE_KEY.exec(key);
    const screenLine = match ? sentLines[Number(match[1])] : undefined;
    const target =
      match && screenLine !== undefined
        ? `prescriptions.${screenLine}.${match[2]}`
        : key;
    fieldErrors[target] = [...(fieldErrors[target] ?? []), ...messages];
  }

  return { ...error, fieldErrors };
}
