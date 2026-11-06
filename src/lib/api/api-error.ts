/** Every failure from the API, in one shape. Message text is shown as sent and never compared. */
export type ApiError = {
  /** The HTTP status, or 0 when no response arrived. */
  status: number;
  /** Absent when the body wasn't the expected shape, so the caller shows its own general text. */
  message?: string;
  /** The API's `errors`, keyed as sent, including nested keys such as `prescriptions.0.dosage`. */
  fieldErrors: Record<string, string[]>;
  /** The 409 `reason`, the only machine-readable code the API has. */
  reason?: string;
};

export type ApiResult<T> =
  { ok: true; status: number; data: T } | { ok: false; error: ApiError };

export const NO_RESPONSE: ApiError = { status: 0, fieldErrors: {} };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readFieldErrors(value: unknown): Record<string, string[]> {
  if (!isRecord(value)) return {};

  const fieldErrors: Record<string, string[]> = {};
  for (const [key, messages] of Object.entries(value)) {
    const texts = Array.isArray(messages)
      ? messages.filter((text): text is string => typeof text === "string")
      : [];
    if (texts.length > 0) fieldErrors[key] = texts;
  }
  return fieldErrors;
}

export function toApiError(status: number, body: unknown): ApiError {
  if (!isRecord(body)) return { status, fieldErrors: {} };

  return {
    status,
    ...(typeof body.message === "string" ? { message: body.message } : {}),
    fieldErrors: readFieldErrors(body.errors),
    ...(typeof body.reason === "string" ? { reason: body.reason } : {}),
  };
}

/** A body that can't be read counts as no body, so the caller shows its own general text. */
export async function readApiResult(
  response: Response,
): Promise<ApiResult<unknown>> {
  const body: unknown = await response.json().catch(() => null);
  return response.ok
    ? { ok: true, status: response.status, data: body }
    : { ok: false, error: toApiError(response.status, body) };
}
