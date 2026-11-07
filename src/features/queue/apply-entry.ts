import type { OwnQueueEntry } from "./types";

/**
 * Puts an action's answer into the list on screen, so it shows even if the read that follows fails. The answer may
 * be about someone who arrived since the last read. That read puts them in the API's order.
 */
export function applyEntry(
  entries: OwnQueueEntry[],
  answer: OwnQueueEntry,
): OwnQueueEntry[] {
  return entries.some((entry) => entry.id === answer.id)
    ? entries.map((entry) => (entry.id === answer.id ? answer : entry))
    : [...entries, answer];
}
