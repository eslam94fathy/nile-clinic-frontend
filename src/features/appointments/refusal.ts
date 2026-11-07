import type { ApiError } from "@/lib/api/api-error";

/** A conflict, or a refusal of the chosen time, so the free times on screen may be out of date. */
export function isAboutTheTime(error: ApiError): boolean {
  return (
    error.status === 409 ||
    error.fieldErrors.start !== undefined ||
    error.fieldErrors.date !== undefined
  );
}
