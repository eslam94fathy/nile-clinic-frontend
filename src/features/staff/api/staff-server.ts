import "server-only";
import { type StaffMember, staffMemberSchema } from "@/features/auth/public";
import type { ApiResult } from "@/lib/api/api-error";
import { itemSchema, pageSchema } from "@/lib/api/pagination";
import { readResource, toQuery } from "@/lib/api/read-resource";

export type StaffFilters = {
  role?: string;
  is_active?: string;
  page?: string;
  per_page?: number;
};

export function readStaffList(locale: string, filters: StaffFilters) {
  return readResource(
    `staff${toQuery(filters)}`,
    locale,
    pageSchema(staffMemberSchema),
  );
}

export function readStaffMember(locale: string, id: number) {
  return readResource(`staff/${id}`, locale, itemSchema(staffMemberSchema));
}

const readStaffPage = (locale: string, page: number) =>
  readResource(
    `staff${toQuery({ per_page: 100, page })}`,
    locale,
    pageSchema(staffMemberSchema),
  );

/**
 * Every account, active or not, for a choice that must offer them all, such as the audit log's. The first page gives
 * the count; the rest are read together. One failed page fails it.
 */
export async function readAllStaff(
  locale: string,
): Promise<ApiResult<StaffMember[]>> {
  const first = await readStaffPage(locale, 1);
  if (!first.ok) return first;

  const rest = await Promise.all(
    Array.from({ length: Math.max(0, first.data.meta.last_page - 1) }, (_, i) =>
      readStaffPage(locale, i + 2),
    ),
  );
  const all = [...first.data.data];
  for (const result of rest) {
    if (!result.ok) return result;
    all.push(...result.data.data);
  }
  return { ok: true, status: first.status, data: all };
}
