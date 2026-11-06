import "server-only";
import { staffMemberSchema } from "@/features/auth/public";
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
