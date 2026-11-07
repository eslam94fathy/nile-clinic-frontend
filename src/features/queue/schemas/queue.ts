import { z } from "zod";
import { QUEUE_STATUSES, type OwnQueueEntry, type QueueEntry } from "../types";

const entryFields = {
  id: z.number(),
  queue_number: z.number(),
  status: z.enum(QUEUE_STATUSES),
  walk_in: z.boolean(),
  arrived_at: z.string(),
  called_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  left_at: z.string().nullable(),
  appointment: z
    .object({ id: z.number(), start: z.string(), end: z.string() })
    .nullable(),
};

export const queueEntrySchema = z.object({
  ...entryFields,
  doctor: z.object({ id: z.number(), name: z.string(), title: z.string() }),
  patient: z.object({
    id: z.number(),
    full_name: z.string(),
    phone: z.string(),
  }),
}) satisfies z.ZodType<QueueEntry>;

export const ownQueueEntrySchema = z.object({
  ...entryFields,
  patient: z.object({
    id: z.number(),
    full_name: z.string(),
    sex: z.enum(["male", "female"]),
    date_of_birth: z.string(),
  }),
}) satisfies z.ZodType<OwnQueueEntry>;
