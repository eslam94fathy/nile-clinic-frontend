import type { components } from "@/lib/api/generated/queues";

export type QueueStatus = components["schemas"]["QueueStatus"];
export type QueueEntry = components["schemas"]["QueueEntry"];
export type OwnQueueEntry = components["schemas"]["OwnQueueEntry"];
export type WalkInInput = components["schemas"]["WalkInInput"];

export const QUEUE_STATUSES = [
  "waiting",
  "with_doctor",
  "seen",
  "left",
] as const satisfies readonly QueueStatus[];

export type QueueFilters = {
  doctorId: number | null;
  status: QueueStatus | null;
  page: number;
};
