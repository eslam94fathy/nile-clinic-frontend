import {
  CONTENT_FIELDS,
  type Encounter,
  type EncounterFormValues,
  type EncounterInput,
  LINE_FIELDS,
  type LineValues,
} from "./types";

export const EMPTY_LINE: LineValues = {
  medication: "",
  dosage: "",
  frequency: "",
  duration: "",
  instructions: "",
};

export function recordToForm(record: Encounter): EncounterFormValues {
  return {
    chief_complaint: record.chief_complaint ?? "",
    examination_findings: record.examination_findings ?? "",
    diagnosis: record.diagnosis ?? "",
    treatment_plan: record.treatment_plan ?? "",
    prescriptions: record.prescriptions.map((line) => ({
      medication: line.medication,
      dosage: line.dosage ?? "",
      frequency: line.frequency ?? "",
      duration: line.duration ?? "",
      instructions: line.instructions ?? "",
    })),
  };
}

const orNull = (text: string) => text.trim() || null;

/**
 * What a save sends: all five keys, as the API replaces the whole draft. A line with nothing in it isn't sent.
 * `sentLines` says which line on screen each sent line came from, as the API's errors count sent lines.
 */
export function toRequest(values: EncounterFormValues): {
  body: EncounterInput;
  sentLines: number[];
} {
  const sentLines = values.prescriptions.flatMap((line, index) =>
    LINE_FIELDS.some((field) => line[field].trim()) ? [index] : [],
  );

  return {
    sentLines,
    body: {
      chief_complaint: orNull(values.chief_complaint),
      examination_findings: orNull(values.examination_findings),
      diagnosis: orNull(values.diagnosis),
      treatment_plan: orNull(values.treatment_plan),
      prescriptions: sentLines.flatMap((index) => {
        const line = values.prescriptions[index];
        return line
          ? [
              {
                // A line with no medication is the API's to refuse, under its own key.
                medication: line.medication.trim(),
                dosage: orNull(line.dosage),
                frequency: orNull(line.frequency),
                duration: orNull(line.duration),
                instructions: orNull(line.instructions),
              },
            ]
          : [];
      }),
    },
  };
}

/** Would a save send anything other than what's saved? Spaces at the ends and empty lines don't count. */
export function hasChanged(
  values: EncounterFormValues,
  saved: Encounter,
): boolean {
  return !sameContent(
    toRequest(values).body,
    toRequest(recordToForm(saved)).body,
  );
}

function sameContent(a: EncounterInput, b: EncounterInput): boolean {
  if (CONTENT_FIELDS.some((field) => a[field] !== b[field])) return false;
  if (a.prescriptions.length !== b.prescriptions.length) return false;
  return a.prescriptions.every((line, index) => {
    const other = b.prescriptions[index];
    return (
      other !== undefined &&
      LINE_FIELDS.every(
        (field) => (line[field] ?? null) === (other[field] ?? null),
      )
    );
  });
}
