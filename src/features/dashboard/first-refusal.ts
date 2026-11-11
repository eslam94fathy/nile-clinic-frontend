import {
  type ApiError,
  type ApiResult,
  NO_RESPONSE,
} from "@/lib/api/api-error";

type Succeeded<Result> = Extract<Result, { ok: true }>;

/** Whether every request of one panel succeeded. A panel shows all its figures from one moment, or none (research R3). */
export function allSucceeded<Results extends readonly ApiResult<unknown>[]>(
  results: Results,
): results is Results & {
  [Index in keyof Results]: Succeeded<Results[Index]>;
} {
  return results.every((result) => result.ok);
}

/** Lower is shown first, so a refusal is never hidden behind a server error. */
const PRIORITY: Record<number, number> = { 401: 0, 403: 1, 404: 2 };
const priorityOf = (error: ApiError) => PRIORITY[error.status] ?? 3;

/** The failure a panel shows for its several requests: `401`, then `403`, then `404`, then the first other. */
export function firstRefusal(results: readonly ApiResult<unknown>[]): ApiError {
  let chosen: ApiError | null = null;
  for (const result of results) {
    if (result.ok) continue;
    if (chosen === null || priorityOf(result.error) < priorityOf(chosen)) {
      chosen = result.error;
    }
  }
  return chosen ?? NO_RESPONSE;
}
