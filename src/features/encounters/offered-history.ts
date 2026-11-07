import type { RecordStatus } from "./types";

/**
 * Who the API is expected to show a history for (research R8), because a refused read writes its own permanent
 * entry, and the application's own links shouldn't lead to one. This only decides what's offered: the API decides.
 */

/** Patients on today's list, or `null` if that couldn't be read. */
export type TodaysPatients = ReadonlySet<number> | null;

export function patientsOnTodaysList(
  entries: readonly { status: string; patient: { id: number } }[],
): ReadonlySet<number> {
  return new Set(
    entries
      .filter(({ status }) => status !== "left")
      .map(({ patient }) => patient.id),
  );
}

export function offeredForQueueRow(status: string): boolean {
  return status !== "left";
}

export function offeredForVisit(
  recordStatus: RecordStatus,
  patientId: number,
  today: TodaysPatients,
): boolean {
  return recordStatus === "finalized" || (today?.has(patientId) ?? false);
}

/** A record the API has just let this doctor read is enough on its own, so only a draft needs asking. */
export function offeredForDraft(
  patientId: number,
  today: TodaysPatients,
): boolean {
  return today?.has(patientId) ?? false;
}
