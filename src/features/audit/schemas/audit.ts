import { z } from "zod";
import type {
  AuditChanges,
  AuditEntry,
  AuditEntryActor,
  AuditPage,
} from "../types";

// Identifiers are any text: one the backend adds later is shown as sent, never a failed page (FR-012, research R5).
const actor = z.object({
  type: z.string(),
  id: z.number().nullable(),
  name: z.string().nullable(),
  role: z.string().nullable(),
}) satisfies z.ZodType<AuditEntryActor>;

const changes = z.object({
  fields: z.array(z.string()),
  values: z.record(
    z.string(),
    z.object({ from: z.unknown(), to: z.unknown() }),
  ),
}) satisfies z.ZodType<AuditChanges>;

export const auditEntrySchema = z.object({
  id: z.number(),
  occurred_at: z.string(),
  action: z.string(),
  outcome: z.string(),
  actor,
  subject: z.object({ type: z.string(), id: z.number() }).nullable(),
  patient_id: z.number().nullable(),
  network_address: z.string().nullable(),
  changes: changes.nullable(),
  // Not `satisfies` the generated type, which reads `Record<string, never>`: see `AuditEntry` in ../types.
  filters: z.record(z.string(), z.union([z.string(), z.number()])).nullable(),
}) satisfies z.ZodType<AuditEntry>;

export const auditPageSchema = z.object({
  data: z.array(auditEntrySchema),
  meta: z.object({
    per_page: z.number(),
    next_cursor: z.string().nullable(),
    prev_cursor: z.string().nullable(),
  }),
}) satisfies z.ZodType<AuditPage>;
