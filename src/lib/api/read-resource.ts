import "server-only";
import type { z } from "zod";
import type { ApiResult } from "./api-error";
import { serverApi } from "./server-api";

/** Reads from the API for a page, and checks the answer. A body that fails the check is a failed read. */
export async function readResource<Schema extends z.ZodType>(
  path: string,
  locale: string,
  schema: Schema,
): Promise<ApiResult<z.output<Schema>>> {
  const result = await serverApi(path, { locale });
  if (!result.ok) return result;

  const body = schema.safeParse(result.data);
  return body.success
    ? { ok: true, status: result.status, data: body.data }
    : { ok: false, error: { status: 0, fieldErrors: {} } };
}

/** The first value of a search parameter, for a page's filters. */
export function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
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
