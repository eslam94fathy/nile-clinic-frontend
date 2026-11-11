import { readClinicDate } from "@/lib/format/clinic-date";
import { minutesToClockTime } from "@/lib/format/clinic-time";
import type { AuditSubject } from "./types";

export type StatusGroup = "appointment" | "queue" | "record" | "charge";

/** How one kept value is shown. Only the fields the backend's allow-list keeps get a kind of their own (research R5). */
export type Described =
  | { kind: "none" }
  | { kind: "status"; group: StatusGroup; value: string }
  | { kind: "role"; value: string }
  | { kind: "active"; value: boolean }
  | { kind: "money"; value: string }
  | { kind: "date"; value: string }
  | { kind: "time"; value: string }
  | { kind: "number"; value: number }
  | { kind: "asSent"; value: string };

// Each record type's `status` is a different list: a visit is a queue entry, and an encounter is a medical record.
const STATUS_GROUPS: Partial<Record<AuditSubject, StatusGroup>> = {
  appointment: "appointment",
  visit: "queue",
  encounter: "record",
  charge: "charge",
};

const MONEY_FIELDS: Partial<Record<AuditSubject, readonly string[]>> = {
  charge: ["fee", "discount", "amount_paid"],
  doctor: ["fee"],
};

function asSent(value: unknown): Described {
  if (typeof value === "string") return { kind: "asSent", value };
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return { kind: "asSent", value: String(value) };
  }
  return { kind: "asSent", value: JSON.stringify(value) ?? String(value) };
}

/**
 * Describes one kept value, by its record type and field. A value whose type doesn't match what the field keeps is
 * shown exactly as sent, so nothing is hidden or reinterpreted. Money is never parsed (constitution V).
 */
export function describeValue(
  subject: AuditSubject | null,
  field: string,
  value: unknown,
): Described {
  if (value === null || value === undefined) return { kind: "none" };

  const statusGroup = subject ? STATUS_GROUPS[subject] : undefined;
  if (field === "status" && statusGroup && typeof value === "string") {
    return { kind: "status", group: statusGroup, value };
  }

  if (
    subject === "staff_member" &&
    field === "role" &&
    typeof value === "string"
  ) {
    return { kind: "role", value };
  }

  if (
    (subject === "staff_member" || subject === "specialty") &&
    field === "is_active" &&
    typeof value === "boolean"
  ) {
    return { kind: "active", value };
  }

  if (
    subject &&
    MONEY_FIELDS[subject]?.includes(field) &&
    typeof value === "string"
  ) {
    return { kind: "money", value };
  }

  if (subject === "appointment") {
    if (field === "date" && typeof value === "string") {
      const date = readClinicDate(value);
      if (date !== null) return { kind: "date", value: date };
    }
    if (field === "start_minute" || field === "end_minute") {
      const time = minutesToClockTime(value);
      if (time !== null) return { kind: "time", value: time };
    }
  }

  if (
    (subject === "appointment" || subject === "visit") &&
    field === "doctor_id" &&
    typeof value === "number" &&
    Number.isInteger(value)
  ) {
    return { kind: "number", value };
  }

  return asSent(value);
}
