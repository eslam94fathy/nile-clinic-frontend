import type { QueueEntry } from "./types";

export type EntryAction = "mark_left" | "undo";

/** What a row offers. This only decides what's shown, and the API's answer wins. */
export function offeredEntryActions(
  entry: Pick<QueueEntry, "status" | "appointment">,
): EntryAction[] {
  if (entry.status !== "waiting") return [];
  return entry.appointment ? ["mark_left", "undo"] : ["mark_left"];
}
