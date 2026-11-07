import type { OwnQueueEntry } from "./types";

export type OwnAction = "finish" | "call_next";

/**
 * What the doctor's page offers. This only decides what's shown: everyone waiting may be with another doctor,
 * which this list can't show, and the API's refusal then says so.
 */
export function offeredOwnAction(
  entries: Pick<OwnQueueEntry, "status">[],
): OwnAction | null {
  if (entries.some(({ status }) => status === "with_doctor")) return "finish";
  return entries.some(({ status }) => status === "waiting")
    ? "call_next"
    : null;
}
