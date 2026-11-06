import type { z } from "zod";
import type { ApiResult } from "./api-error";

/** A body that fails the check is a failed read. For both the server's reads and the browser's. */
export function checkResult<Schema extends z.ZodType>(
  result: ApiResult<unknown>,
  schema: Schema,
): ApiResult<z.output<Schema>> {
  if (!result.ok) return result;

  const body = schema.safeParse(result.data);
  return body.success
    ? { ok: true, status: result.status, data: body.data }
    : { ok: false, error: { status: 0, fieldErrors: {} } };
}

/** A query string from the values that are set, so that blank filters aren't sent. */
export function toQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(name, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}
