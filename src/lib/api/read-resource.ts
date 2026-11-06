import "server-only";
import type { z } from "zod";
import type { ApiResult } from "./api-error";
import { checkResult } from "./check-result";
import { serverApi } from "./server-api";

export { toQuery } from "./check-result";

/** Reads from the API for a page, and checks the answer. A body that fails the check is a failed read. */
export async function readResource<Schema extends z.ZodType>(
  path: string,
  locale: string,
  schema: Schema,
): Promise<ApiResult<z.output<Schema>>> {
  return checkResult(await serverApi(path, { locale }), schema);
}

/** The first value of a search parameter, for a page's filters. */
export function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
