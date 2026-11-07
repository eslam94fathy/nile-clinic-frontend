import { createAuditedOpening } from "@/lib/audited-opening";
import type { Encounter } from "./types";

// Each opening of a record or a history writes a permanent entry, so these say what a person actually did. Memory
// only, and a full page load, which sign-out always is, clears them (ADR 0012).

export const recordOpening = createAuditedOpening<Encounter>();
export const historyOpening = createAuditedOpening<{ id: number }>();

const namesAsked = new Map<number, string>();

/**
 * A history has no patient's name, and someone reading clinical history should see whose it is. So the link that
 * knows passes it, in memory. After a reload, or in another tab, only the number shows.
 */
export function noteHistoryName(patientId: number, name: string): void {
  namesAsked.set(patientId, name);
}

export function takeHistoryName(patientId: number): string | null {
  const name = namesAsked.get(patientId) ?? null;
  namesAsked.delete(patientId);
  return name;
}
