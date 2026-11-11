import type { ApiResult } from "@/lib/api/api-error";
import { browserApi } from "@/lib/api/browser-api";
import { checkResult, toQuery } from "@/lib/api/check-result";
import { auditPageSchema } from "../schemas/audit";
import { AUDIT_PAGE_SIZE, type AuditFilters, type AuditPage } from "../types";

/**
 * One page of the trail. **Every call writes a permanent `audit.searched` entry**, so only a person's press may make
 * one, and nothing here retries (ADR 0018). The cursor holds a position only, so the same filters go with it.
 */
export async function searchAuditEntries(
  filters: AuditFilters,
  cursor: string | null,
  locale: string,
): Promise<ApiResult<AuditPage>> {
  const query = toQuery({
    ...filters,
    per_page: AUDIT_PAGE_SIZE,
    cursor: cursor ?? undefined,
  });
  return checkResult(
    await browserApi(`audit-entries${query}`, { locale }),
    auditPageSchema,
  );
}
