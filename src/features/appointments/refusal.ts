import type { ApiError } from "@/lib/api/api-error";

/**
 * Whether a change may have been saved despite the failure: no response arrived, or the same-origin route
 * got no usable one from the backend. A `500` is different, as the API defines it as "the action did not
 * happen".
 */
export function isOutcomeUnknown(error: ApiError): boolean {
  return error.status === 0 || error.status >= 502;
}

/** A conflict, or a refusal of the chosen time, so the free times on screen may be out of date. */
export function isAboutTheTime(error: ApiError): boolean {
  return (
    error.status === 409 ||
    error.fieldErrors.start !== undefined ||
    error.fieldErrors.date !== undefined
  );
}

/** Everything the API said, for showing somewhere with no field of its own. None of it is dropped. */
export function allMessages(error: ApiError, fallback: string): string[] {
  const messages = Object.values(error.fieldErrors).flat();
  if (messages.length > 0) return messages;
  return [error.message ?? fallback];
}
