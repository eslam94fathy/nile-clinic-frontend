import { useLocale, useTranslations } from "next-intl";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { FilterBar } from "@/components/shared/filter-bar";
import { EmptyState } from "@/components/shared/states/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserText } from "@/components/shared/values/user-text";
import { type PageMeta, pageHref } from "@/lib/api/pagination";
import { Link } from "@/lib/i18n/navigation";
import type { DoctorSummary, Specialty } from "../types";

export function DoctorList({
  rows,
  meta,
  filters,
  specialties,
}: {
  rows: DoctorSummary[];
  meta: PageMeta;
  filters: {
    name?: string | undefined;
    specialty_id?: string | undefined;
    is_active?: string | undefined;
  };
  specialties: Specialty[];
}) {
  const locale = useLocale();
  const t = useTranslations("doctors");
  const nameOf = (specialty: Specialty) =>
    locale === "ar" ? specialty.name_ar : specialty.name_en;
  const filtered = Boolean(
    filters.name || filters.specialty_id || filters.is_active,
  );

  const columns: DataTableColumn<DoctorSummary>[] = [
    {
      id: "name",
      header: t("name"),
      cell: (row) => (
        <Link
          href={`/doctors/${row.id}`}
          prefetch={false}
          className="font-medium underline underline-offset-4"
        >
          <UserText>{row.name}</UserText>
        </Link>
      ),
    },
    {
      id: "title",
      header: t("fieldTitle"),
      cell: (row) => <UserText>{row.title}</UserText>,
    },
    {
      id: "specialties",
      header: t("specialties"),
      cell: (row) => (
        <ul className="flex flex-col">
          {row.specialties.map((specialty) => (
            <li key={specialty.id}>
              <UserText>{nameOf(specialty)}</UserText>
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: "status",
      header: t("status"),
      cell: (row) => (
        <StatusBadge
          kind="activity"
          value={row.is_active ? "active" : "inactive"}
        />
      ),
    },
  ];

  return (
    <>
      <FilterBar
        filters={[
          { name: "name", label: t("name"), type: "text", inAddress: true },
          {
            name: "specialty_id",
            label: t("specialty"),
            type: "select",
            inAddress: true,
            options: [
              { value: "", label: t("anySpecialty") },
              ...specialties.map((specialty) => ({
                value: String(specialty.id),
                label: nameOf(specialty),
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
              { value: "0", label: t("inactive") },
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
          hrefForPage: pageHref("/doctors", filters),
        }}
      />
    </>
  );
}
