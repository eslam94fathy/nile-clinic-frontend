import type { components } from "@/lib/api/generated/scheduling";

export type Day = components["schemas"]["Day"];
export type Schedule = components["schemas"]["Schedule"];
export type Slot = components["schemas"]["Slot"];
export type TimeOff = components["schemas"]["TimeOff"];

/** A doctor's id, or the signed-in doctor themselves. */
export type DoctorRef = number | "me";

/** Always in this order, as the API returns them. */
export const DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const satisfies readonly Day[];
