import type { Patient } from "./types";

// Each read of a record writes a permanent audit entry, so these say what a person actually did. All of it
// lives in memory only, and a full page load, which sign-out always is, clears it (ADR 0012).

let handedOver: Patient | null = null;
const asked = new Set<number>();
let changes = 0;

/** A record the API has just returned, so that showing it doesn't need a read that nobody asked for. */
export function handOver(record: Patient): void {
  handedOver = record;
}

export function takeHandedOver(id: number): Patient | null {
  if (handedOver?.id !== id) return null;

  const record = handedOver;
  handedOver = null;
  return record;
}

/** A person clicked a link to this record. Only a click can say so: the back button leaves no such mark. */
export function markAsked(id: number): void {
  asked.add(id);
}

export function takeAsked(id: number): boolean {
  return asked.delete(id);
}

/** A patient was registered or changed, so a search result held on a hidden page may be out of date. */
export function noteChange(): void {
  changes += 1;
}

export function changeCount(): number {
  return changes;
}
