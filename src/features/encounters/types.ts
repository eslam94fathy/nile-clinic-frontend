import type { components } from "@/lib/api/generated/encounters";
import type { PageMeta } from "@/lib/api/pagination";

export type RecordStatus = components["schemas"]["RecordStatus"];
export type Visit = components["schemas"]["Visit"];
export type Encounter = components["schemas"]["Encounter"];
export type Addendum = components["schemas"]["Addendum"];
export type PrescriptionLine = components["schemas"]["PrescriptionLine"];
export type EncounterInput = components["schemas"]["EncounterInput"];
export type EncounterHistoryItem =
  components["schemas"]["EncounterHistoryItem"];

export type HistoryPage = { data: EncounterHistoryItem[]; meta: PageMeta };

/** The most lines the API accepts. */
export const MOST_LINES = 20;

export const RECORD_STATUSES = [
  "none",
  "draft",
  "finalized",
] as const satisfies readonly RecordStatus[];

export const CONTENT_FIELDS = [
  "chief_complaint",
  "examination_findings",
  "diagnosis",
  "treatment_plan",
] as const;

export const LINE_FIELDS = [
  "medication",
  "dosage",
  "frequency",
  "duration",
  "instructions",
] as const;

export type LineValues = Record<(typeof LINE_FIELDS)[number], string>;

/** Held only in the open page's memory. Every value is text, as an empty field is empty text until it's sent. */
export type EncounterFormValues = Record<
  (typeof CONTENT_FIELDS)[number],
  string
> & { prescriptions: LineValues[] };

export type VisitFilters = {
  from: string;
  to: string;
  record_status?: RecordStatus;
  page?: number;
};
