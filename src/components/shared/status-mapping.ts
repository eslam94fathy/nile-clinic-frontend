import type { components as Appointments } from "@/lib/api/generated/appointments";
import type { components as Encounters } from "@/lib/api/generated/encounters";
import type { components as Payments } from "@/lib/api/generated/payments";
import type { components as Queues } from "@/lib/api/generated/queues";

export type StatusTone = "neutral" | "active" | "success" | "warning" | "muted";

type AppointmentStatus = Appointments["schemas"]["Status"];
type QueueStatus = Queues["schemas"]["QueueStatus"];
// A charge's own status, plus `none`, which visit lists use for a visit with no charge.
type ChargeStatus = Payments["schemas"]["ChargeStatus"] | "none";
type RecordStatus = Encounters["schemas"]["RecordStatus"];

// `satisfies` makes each of these exhaustive: a value added to a contract fails type checking here.
const appointment = {
  scheduled: "neutral",
  checked_in: "active",
  completed: "success",
  no_show: "warning",
  cancelled: "muted",
} satisfies Record<AppointmentStatus, StatusTone>;

const queue = {
  waiting: "neutral",
  with_doctor: "active",
  seen: "success",
  // The backend's status, not a position. Computed, so the logical-styles check can stay strict.
  ["left"]: "warning",
} satisfies Record<QueueStatus, StatusTone>;

const charge = {
  none: "neutral",
  partially_paid: "active",
  paid: "success",
  unpaid: "warning",
  cancelled: "muted",
} satisfies Record<ChargeStatus, StatusTone>;

const record = {
  none: "neutral",
  draft: "active",
  finalized: "success",
} satisfies Record<RecordStatus, StatusTone>;

// Not an API enum: staff, specialties, and doctors each report this as a flag, shown here in words.
const activity = {
  active: "success",
  deactivated: "muted",
  inactive: "muted",
} satisfies Record<string, StatusTone>;

export const statusTones = { appointment, queue, charge, record, activity };

export type StatusKind = keyof typeof statusTones;
export type StatusValue<Kind extends StatusKind> =
  keyof (typeof statusTones)[Kind];

export function isKnownStatus(kind: StatusKind, value: string): boolean {
  return Object.hasOwn(statusTones[kind], value);
}

export function toneOf(kind: StatusKind, value: string): StatusTone {
  const tones: Record<string, StatusTone> = statusTones[kind];
  return isKnownStatus(kind, value) ? (tones[value] ?? "neutral") : "neutral";
}
