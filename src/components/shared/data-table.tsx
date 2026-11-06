import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCount } from "@/lib/format/locale";
import { Link } from "@/lib/i18n/navigation";
import { LoadingState } from "./states/loading-state";

export type DataTableColumn<Row> = {
  id: string;
  header: string;
  cell: (row: Row) => ReactNode;
};

type PageTarget =
  | { hrefForPage: (page: number) => string; onPage?: never }
  /** For a list whose filters can't be in the address, so neither can its pages. */
  | { onPage: (page: number) => void; hrefForPage?: never };

export type DataTablePagination = {
  page: number;
  lastPage: number;
  total: number;
} & PageTarget;

type DataTableProps<Row> = {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string;
  /** Names the table for assistive technology. */
  caption: string;
  state: "loading" | "error" | "empty" | "ready";
  /** Shown when `state` is `error`: usually an `ErrorState`. */
  errorState?: ReactNode;
  /** Shown when `state` is `empty`: usually an `EmptyState`. */
  emptyState?: ReactNode;
  pagination?: DataTablePagination;
};

// Long values wrap and are never truncated, so all of the value stays readable.
const longValues = "whitespace-normal [overflow-wrap:anywhere]";

function PageLink({
  page,
  target,
  label,
  icon,
  disabled,
}: {
  page: number;
  target: PageTarget;
  label: string;
  icon: ReactNode;
  disabled: boolean;
}) {
  if (disabled) {
    return (
      <Button type="button" variant="outline" size="sm" disabled>
        {label}
        {icon}
      </Button>
    );
  }

  // Only here does a function reach the button: a table on a server-rendered page can't pass one.
  if (target.onPage) {
    const { onPage } = target;
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onPage(page)}
      >
        {label}
        {icon}
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" asChild>
      {/* No prefetch: a list's next page must not load until someone asks for it (ADR 0005). */}
      <Link href={target.hrefForPage(page)} prefetch={false}>
        {label}
        {icon}
      </Link>
    </Button>
  );
}

function Pagination({ page, lastPage, total, ...target }: DataTablePagination) {
  const t = useTranslations("shared.table");
  const locale = useLocale();

  return (
    <nav
      aria-label={t("pagination")}
      className="flex flex-wrap items-center justify-between gap-2 py-3 text-[0.8125rem] text-muted-foreground"
    >
      <p>
        {t("summary", {
          page: formatCount(page, locale),
          lastPage: formatCount(lastPage, locale),
          total,
          count: formatCount(total, locale),
        })}
      </p>
      <div className="flex gap-2">
        <PageLink
          page={page - 1}
          target={target}
          label={t("previous")}
          icon={<ChevronLeftIcon className="rtl:rotate-180" />}
          disabled={page <= 1}
        />
        <PageLink
          page={page + 1}
          target={target}
          label={t("next")}
          icon={<ChevronRightIcon className="rtl:rotate-180" />}
          disabled={page >= lastPage}
        />
      </div>
    </nav>
  );
}

export function DataTable<Row>({
  columns,
  rows,
  getRowKey,
  caption,
  state,
  errorState,
  emptyState,
  pagination,
}: DataTableProps<Row>) {
  if (state === "loading") return <LoadingState />;
  if (state === "error") return <>{errorState}</>;
  if (state === "empty") return <>{emptyState}</>;

  return (
    <div className="flex flex-col rounded-lg bg-card px-4 text-card-foreground">
      {/* At tablet width and up, a real table. display: none removes the other from assistive technology. */}
      <div className="hidden md:block">
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHeader>
            <TableRow className="border-input hover:bg-transparent">
              {columns.map((column) => (
                <TableHead
                  key={column.id}
                  scope="col"
                  className="h-10 ps-0 pe-3 text-start text-[0.8125rem] whitespace-normal text-muted-foreground"
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={getRowKey(row)} className="h-12">
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    className={`ps-0 pe-3 ${longValues}`}
                  >
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul aria-label={caption} className="flex flex-col md:hidden">
        {rows.map((row) => (
          <li key={getRowKey(row)} className="border-b py-3 last:border-b-0">
            <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-1">
              {columns.map((column) => (
                <div key={column.id} className="contents">
                  <dt className="text-[0.8125rem] text-muted-foreground">
                    {column.header}
                  </dt>
                  <dd className={longValues}>{column.cell(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      {pagination ? <Pagination {...pagination} /> : null}
    </div>
  );
}
