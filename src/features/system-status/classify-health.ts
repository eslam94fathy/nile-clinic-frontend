import { z } from "zod";
import type { ConnectivityStatus, Health } from "./types";

const state = z.enum(["ok", "unavailable"]);

// `satisfies` ties this to the type generated from the backend's contract, so a contract change
// that this no longer matches fails type checking.
const healthSchema = z.strictObject({
  status: state,
  checks: z.strictObject({ database: state }),
}) satisfies z.ZodType<Health>;

/** Reports "working" only for the exact healthy response the contract documents. */
export function classifyHealth(
  httpStatus: number,
  body: unknown,
): ConnectivityStatus {
  const parsed = healthSchema.safeParse(body);
  if (!parsed.success) return "unreachable";

  // The contract documents only these two. Anything else isn't the backend answering.
  if (httpStatus !== 200 && httpStatus !== 503) return "unreachable";

  const { status, checks } = parsed.data;
  if (status === "unavailable" || checks.database === "unavailable") {
    return "unavailable";
  }
  return httpStatus === 200 ? "working" : "unreachable";
}
