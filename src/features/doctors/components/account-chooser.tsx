import { useTranslations } from "next-intl";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/states/empty-state";
import { LtrText } from "@/components/shared/values/ltr-text";
import { UserText } from "@/components/shared/values/user-text";
import { Button } from "@/components/ui/button";
import type { StaffMember } from "@/features/auth/public";
import { type PageMeta, pageHref } from "@/lib/api/pagination";
import { Link } from "@/lib/i18n/navigation";

/**
 * The API can't say which accounts already have a profile (gap G2), so the note says so, and its refusal on
 * saving is what decides. A table, rather than a dropdown, as there's no search and no limit on how many.
 */
export function AccountChooser({
  rows,
  meta,
}: {
  rows: StaffMember[];
  meta: PageMeta;
}) {
  const t = useTranslations("doctors");

  const columns: DataTableColumn<StaffMember>[] = [
    {
      id: "name",
      header: t("name"),
      cell: (row) => <UserText>{row.name}</UserText>,
    },
    {
      id: "email",
      header: t("email"),
      cell: (row) => <LtrText breakable>{row.email}</LtrText>,
    },
    {
      id: "choose",
      header: t("account"),
      cell: (row) => (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/doctors/new?account=${row.id}`} prefetch={false}>
            {t("choose")}
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <>
      <p className="text-muted-foreground">{t("chooseNote")}</p>
      <DataTable
        caption={t("accountsCaption")}
        columns={columns}
        rows={rows}
        getRowKey={(row) => String(row.id)}
        // By the total, as a page past the end has no rows, and needs its links back.
        state={meta.total === 0 ? "empty" : "ready"}
        emptyState={
          <EmptyState
            title={t("noAccountsTitle")}
            description={t("noAccountsDescription")}
            action={
              <Button variant="outline" size="sm" asChild>
                <Link href="/staff/new?role=doctor" prefetch={false}>
                  {t("newDoctorAccount")}
                </Link>
              </Button>
            }
          />
        }
        pagination={{
          page: meta.current_page,
          lastPage: meta.last_page,
          total: meta.total,
          hrefForPage: pageHref("/doctors/new", {}),
        }}
      />
    </>
  );
}
