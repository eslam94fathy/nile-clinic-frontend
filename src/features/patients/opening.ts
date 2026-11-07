import { createAuditedOpening } from "@/lib/audited-opening";
import type { Patient } from "./types";

export const { handOver, takeHandedOver, markAsked, takeAsked } =
  createAuditedOpening<Patient>();

let changes = 0;

/** A patient was registered or changed, so a search result held on a hidden page may be out of date. */
export function noteChange(): void {
  changes += 1;
}

export function changeCount(): number {
  return changes;
}
