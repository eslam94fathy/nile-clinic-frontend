import type { Patient } from "./types";

// Each read of a record writes a permanent audit entry, so these say what a person actually did. All of it
// lives in memory only, and a full page load, which sign-out always is, clears it (ADR 0012).

// A navigation that's overtaken never reaches the reader, so what it left here must not last. Otherwise the
// back button could find it later, and write an opening that nobody asked for. A navigation slower than this
// shows what's held, and "Reload details" is still there.
const LIFETIME_MS = 15_000;
const stillFresh = (at: number) => Date.now() - at < LIFETIME_MS;

let handedOver: { record: Patient; at: number } | null = null;
const asked = new Map<number, number>();
let changes = 0;

/** A record the API has just returned, so that showing it doesn't need a read that nobody asked for. */
export function handOver(record: Patient): void {
  handedOver = { record, at: Date.now() };
}

export function takeHandedOver(id: number): Patient | null {
  if (handedOver?.record.id !== id) return null;

  const { record, at } = handedOver;
  handedOver = null;
  return stillFresh(at) ? record : null;
}

/** A person clicked a link to this record. Only a click can say so: the back button leaves no such mark. */
export function markAsked(id: number): void {
  asked.set(id, Date.now());
}

export function takeAsked(id: number): boolean {
  const at = asked.get(id);
  asked.delete(id);
  return at !== undefined && stillFresh(at);
}

/** A patient was registered or changed, so a search result held on a hidden page may be out of date. */
export function noteChange(): void {
  changes += 1;
}

export function changeCount(): number {
  return changes;
}
