import { cleanup, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { DataTable, type DataTableColumn } from "./data-table";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
}));

afterEach(cleanup);

type Row = { id: string; name: string };

const columns: DataTableColumn<Row>[] = [
  { id: "name", header: "Name", cell: (row) => row.name },
  { id: "id", header: "Code", cell: (row) => row.id },
];
const longName = "Synthetic".repeat(30);
const rows: Row[] = [
  { id: "1", name: "Test Patient Alpha" },
  { id: "2", name: longName },
];
const table = {
  columns,
  rows,
  getRowKey: (row: Row) => row.id,
  caption: "Sample",
};
const text = messagesByLocale.en.shared.table;

describe("paging with buttons, for a list that can't be in the address", () => {
  const pagination = { page: 2, lastPage: 3, total: 40 };

  it("calls back with the page, and renders no links", () => {
    const onPage = vi.fn();
    renderWithIntl(
      <DataTable
        {...table}
        state="ready"
        pagination={{ ...pagination, onPage }}
      />,
    );

    const pages = screen.getByRole("navigation", { name: text.pagination });
    expect(within(pages).queryByRole("link")).toBeNull();
    within(pages).getByRole("button", { name: text.next }).click();
    expect(onPage).toHaveBeenCalledWith(3);
    within(pages).getByRole("button", { name: text.previous }).click();
    expect(onPage).toHaveBeenCalledWith(1);
  });

  it("disables what isn't there", () => {
    renderWithIntl(
      <DataTable
        {...table}
        state="ready"
        pagination={{ page: 1, lastPage: 1, total: 2, onPage: vi.fn() }}
      />,
    );

    const pages = screen.getByRole("navigation", { name: text.pagination });
    for (const name of [text.previous, text.next]) {
      expect(
        within(pages).getByRole<HTMLButtonElement>("button", { name }).disabled,
      ).toBe(true);
    }
  });
});

describe("states", () => {
  it("loading", () => {
    renderWithIntl(<DataTable {...table} state="loading" />);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("error shows what it's given", () => {
    renderWithIntl(
      <DataTable {...table} state="error" errorState={<p>{"Failed"}</p>} />,
    );
    expect(screen.getByText("Failed")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("empty shows what it's given", () => {
    renderWithIntl(
      <DataTable {...table} state="empty" emptyState={<p>{"Nothing"}</p>} />,
    );
    expect(screen.getByText("Nothing")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("ready", () => {
  it("has a caption and real column headers", () => {
    renderWithIntl(<DataTable {...table} state="ready" />);
    const grid = screen.getByRole("table", { name: "Sample" });
    const headers = within(grid).getAllByRole("columnheader");

    expect(headers.map((header) => header.textContent)).toEqual([
      "Name",
      "Code",
    ]);
    expect(headers[0]?.getAttribute("scope")).toBe("col");
  });

  it("offers no sorting", () => {
    renderWithIntl(<DataTable {...table} state="ready" />);
    const grid = screen.getByRole("table");

    expect(within(grid).queryAllByRole("button")).toEqual([]);
    expect(grid.querySelector("[aria-sort]")).toBeNull();
  });

  it("keeps a long value whole, wrapping and never truncating", () => {
    const { container } = renderWithIntl(
      <DataTable {...table} state="ready" />,
    );

    expect(container.textContent).toContain(longName);
    expect(container.querySelector(".truncate, .text-ellipsis")).toBeNull();
    expect(container.innerHTML).toContain("[overflow-wrap:anywhere]");
  });
});

describe("pagination", () => {
  const pagination = {
    page: 2,
    lastPage: 3,
    total: 42,
    hrefForPage: (page: number) => `/visits?page=${page}`,
  };

  it("shows the totals, in both languages", () => {
    for (const [locale, expected] of [
      ["en", "Page 2 of 3, 42 results"],
      ["ar", "صفحة 2 من 3، 42 نتيجة"],
    ] as const) {
      const { container, unmount } = renderWithIntl(
        <DataTable {...table} state="ready" pagination={pagination} />,
        locale,
      );
      expect(container.textContent).toContain(expected);
      unmount();
    }
  });

  it("links both ways, without prefetching", () => {
    renderWithIntl(
      <DataTable {...table} state="ready" pagination={pagination} />,
    );
    const previous = screen.getByRole("link", { name: text.previous });
    const next = screen.getByRole("link", { name: text.next });

    expect(previous.getAttribute("href")).toBe("/visits?page=1");
    expect(next.getAttribute("href")).toBe("/visits?page=3");
    expect(next.getAttribute("data-prefetch")).toBe("false");
  });

  it("disables the ends", () => {
    renderWithIntl(
      <DataTable
        {...table}
        state="ready"
        pagination={{ ...pagination, page: 1, lastPage: 1 }}
      />,
    );

    expect(screen.queryByRole("link", { name: text.previous })).toBeNull();
    expect(screen.queryByRole("link", { name: text.next })).toBeNull();
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: text.next })
        .disabled,
    ).toBe(true);
  });
});
