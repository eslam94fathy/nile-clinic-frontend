import { useTranslations } from "next-intl";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/states/empty-state";
import { Instant } from "@/components/shared/values/instant";
import { Money } from "@/components/shared/values/money";
import { NoValue } from "@/components/shared/values/no-value";
import { UserText } from "@/components/shared/values/user-text";
import { type PageMeta, pageHref } from "@/lib/api/pagination";
import { Link } from "@/lib/i18n/navigation";
import type { DoctorFee } from "../types";

export function FeeList({
  rows,
  meta,
  timeZone,
}: {
  rows: DoctorFee[];
  meta: PageMeta;
  timeZone: string;
}) {
  const t = useTranslations("fees");

  const columns: DataTableColumn<DoctorFee>[] = [
    {
      id: "doctor",
      header: t("doctor"),
      cell: (row) => (
        <Link
          href={`/doctors/${row.doctor.id}`}
          prefetch={false}
          className="font-medium underline underline-offset-4"
        >
          <UserText>{row.doctor.name}</UserText>
        </Link>
      ),
    },
    {
      id: "amount",
      header: t("amount"),
      cell: (row) =>
        row.amount === null ? t("notSet") : <Money value={row.amount} />,
    },
    {
      id: "setBy",
      header: t("setBy"),
      cell: (row) =>
        row.set_by ? <UserText>{row.set_by.name}</UserText> : <NoValue />,
    },
    {
      id: "setAt",
      header: t("setAt"),
      cell: (row) => <Instant value={row.set_at} timeZone={timeZone} />,
    },
  ];

  return (
    <DataTable
      caption={t("caption")}
      columns={columns}
      rows={rows}
      getRowKey={(row) => String(row.doctor.id)}
      state={rows.length === 0 ? "empty" : "ready"}
      emptyState={
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      }
      pagination={{
        page: meta.current_page,
        lastPage: meta.last_page,
        total: meta.total,
        hrefForPage: pageHref("/fees", {}),
      }}
    />
  );
}
