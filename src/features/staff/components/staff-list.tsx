import { useTranslations } from "next-intl";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { FilterBar } from "@/components/shared/filter-bar";
import { EmptyState } from "@/components/shared/states/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { LtrText } from "@/components/shared/values/ltr-text";
import { UserText } from "@/components/shared/values/user-text";
import type { StaffMember } from "@/features/auth/public";
import { type PageMeta, pageHref } from "@/lib/api/pagination";
import { Link } from "@/lib/i18n/navigation";
import { STAFF_ROLES } from "../schemas/staff";

/** There's no name search, because the API has none (gap G1). */
export function StaffList({
  rows,
  meta,
  filters,
}: {
  rows: StaffMember[];
  meta: PageMeta;
  filters: { role?: string | undefined; is_active?: string | undefined };
}) {
  const t = useTranslations("staff");
  const roles = useTranslations("roles");
  const filtered = Boolean(filters.role || filters.is_active);

  const columns: DataTableColumn<StaffMember>[] = [
    {
      id: "name",
      header: t("name"),
      cell: (row) => (
        <Link
          href={`/staff/${row.id}`}
          prefetch={false}
          className="font-medium underline underline-offset-4"
        >
          <UserText>{row.name}</UserText>
        </Link>
      ),
    },
    {
      id: "email",
      header: t("email"),
      cell: (row) => <LtrText>{row.email}</LtrText>,
    },
    { id: "role", header: t("role"), cell: (row) => roles(row.role) },
    {
      id: "status",
      header: t("status"),
      cell: (row) => (
        <StatusBadge
          kind="activity"
          value={row.is_active ? "active" : "deactivated"}
        />
      ),
    },
  ];

  return (
    <>
      <FilterBar
        filters={[
          {
            name: "role",
            label: t("role"),
            type: "select",
            inAddress: true,
            options: [
              { value: "", label: t("anyRole") },
              ...STAFF_ROLES.map((role) => ({
                value: role,
                label: roles(role),
              })),
            ],
          },
          {
            name: "is_active",
            label: t("status"),
            type: "select",
            inAddress: true,
            options: [
              { value: "", label: t("anyStatus") },
              { value: "1", label: t("active") },
              { value: "0", label: t("deactivatedStatus") },
            ],
          },
        ]}
      />
      <DataTable
        caption={t("caption")}
        columns={columns}
        rows={rows}
        getRowKey={(row) => String(row.id)}
        state={rows.length === 0 ? "empty" : "ready"}
        emptyState={
          filtered ? (
            <EmptyState
              title={t("emptyFilteredTitle")}
              description={t("emptyFilteredDescription")}
            />
          ) : (
            <EmptyState
              title={t("emptyTitle")}
              description={t("emptyDescription")}
            />
          )
        }
        pagination={{
          page: meta.current_page,
          lastPage: meta.last_page,
          total: meta.total,
          hrefForPage: pageHref("/staff", filters),
        }}
      />
    </>
  );
}
