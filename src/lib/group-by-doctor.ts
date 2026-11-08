import type { QueueEntry } from "./types";

export type DoctorGroup = {
  doctor: QueueEntry["doctor"];
  entries: QueueEntry[];
};

/** Adjacent rows of one doctor, in the API's order, which is never changed here. */
export function groupByDoctor(entries: QueueEntry[]): DoctorGroup[] {
  const groups: DoctorGroup[] = [];
  for (const entry of entries) {
    const current = groups.at(-1);
    if (current?.doctor.id === entry.doctor.id) current.entries.push(entry);
    else groups.push({ doctor: entry.doctor, entries: [entry] });
  }
  return groups;
}
