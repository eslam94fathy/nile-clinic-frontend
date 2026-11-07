import type { OwnQueueEntry } from "./types";

/** Puts an action's answer into the list on screen, so it shows even if the read that follows fails. */
export function applyEntry(
  entries: OwnQueueEntry[],
  answer: OwnQueueEntry,
): OwnQueueEntry[] {
  return entries.map((entry) => (entry.id === answer.id ? answer : entry));
}
