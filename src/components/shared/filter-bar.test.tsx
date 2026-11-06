import { cleanup, fireEvent, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { FilterBar, type FilterDefinition } from "./filter-bar";

const push = vi.fn();
let query = "";

vi.mock("@/lib/i18n/navigation", () => ({
  usePathname: () => "/visits",
  useRouter: () => ({ push }),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(query),
}));

beforeEach(() => {
  push.mockClear();
  query = "";
});
afterEach(cleanup);

const text = messagesByLocale.en.shared.filters;
const filters: FilterDefinition[] = [
  { name: "date", label: "Date", type: "text", inAddress: true },
  {
    name: "status",
    label: "Status",
    type: "select",
    inAddress: true,
    options: [
      { value: "", label: "All" },
      { value: "seen", label: "Seen" },
    ],
  },
  { name: "search", label: "Search", type: "text", inAddress: false },
];

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const apply = () =>
  fireEvent.click(screen.getByRole("button", { name: text.apply }));

describe("FilterBar", () => {
  it("writes applied filters to the address", () => {
    renderWithIntl(<FilterBar filters={filters} />);
    type("Date", "2026-11-08");
    type("Status", "seen");
    apply();

    expect(push).toHaveBeenCalledWith("/visits?date=2026-11-08&status=seen");
  });

  it("does nothing until applied", () => {
    renderWithIntl(<FilterBar filters={filters} />);
    type("Date", "2026-11-08");
    expect(push).not.toHaveBeenCalled();
  });

  it("resets to page one, and keeps unrelated address values", () => {
    query = "page=4&tab=open";
    renderWithIntl(<FilterBar filters={filters} />);
    type("Date", "2026-11-08");
    apply();

    expect(push).toHaveBeenCalledWith("/visits?tab=open&date=2026-11-08");
  });

  it("starts from the address", () => {
    query = "date=2026-11-08&status=seen";
    renderWithIntl(<FilterBar filters={filters} />);

    expect(screen.getByLabelText<HTMLInputElement>("Date").value).toBe(
      "2026-11-08",
    );
    expect(screen.getByLabelText<HTMLSelectElement>("Status").value).toBe(
      "seen",
    );
  });

  it("reset clears the filters from the address", () => {
    query = "date=2026-11-08&tab=open";
    const onApply = vi.fn();
    renderWithIntl(<FilterBar filters={filters} onApply={onApply} />);
    fireEvent.click(screen.getByRole("button", { name: text.reset }));

    expect(push).toHaveBeenCalledWith("/visits?tab=open");
    expect(onApply).toHaveBeenCalledWith({});
  });

  it("gives a private filter to onApply, and never to the address", () => {
    const onApply = vi.fn();
    renderWithIntl(<FilterBar filters={filters} onApply={onApply} />);
    type("Search", "Test Patient Alpha");
    apply();

    expect(onApply).toHaveBeenCalledWith({
      date: "",
      status: "",
      search: "Test Patient Alpha",
    });
    expect(String(push.mock.calls[0]?.[0])).not.toContain("Patient");
    expect(String(push.mock.calls[0]?.[0])).not.toContain("search");
  });

  it("gives a private filter no name, so a browser can't submit it to the address", () => {
    renderWithIntl(<FilterBar filters={filters} />);

    expect(screen.getByLabelText("Search").hasAttribute("name")).toBe(false);
    expect(screen.getByLabelText("Date").getAttribute("name")).toBe("date");
  });

  it("doesn't push the same address again, and still reports the values", () => {
    query = "date=2026-11-08";
    const onApply = vi.fn();
    renderWithIntl(<FilterBar filters={filters} onApply={onApply} />);
    type("Search", "Test Patient Alpha");
    apply();

    expect(push).not.toHaveBeenCalled();
    expect(onApply).toHaveBeenCalledOnce();
  });

  it("reset on a clean address doesn't push", () => {
    renderWithIntl(<FilterBar filters={filters} />);
    fireEvent.click(screen.getByRole("button", { name: text.reset }));
    expect(push).not.toHaveBeenCalled();
  });

  it("follows the address, keeping what's typed in a private filter", () => {
    const { rerender } = renderWithIntl(<FilterBar filters={filters} />);
    type("Search", "Test Patient Alpha");
    query = "date=2026-11-08";
    rerender(
      <NextIntlClientProvider
        locale="en"
        messages={messagesByLocale.en}
        timeZone="Africa/Cairo"
      >
        <FilterBar filters={filters} />
      </NextIntlClientProvider>,
    );

    expect(screen.getByLabelText<HTMLInputElement>("Date").value).toBe(
      "2026-11-08",
    );
    expect(screen.getByLabelText<HTMLInputElement>("Search").value).toBe(
      "Test Patient Alpha",
    );
  });

  it("won't compile a filter that doesn't say where it goes", () => {
    const missing: FilterDefinition = {
      name: "search",
      label: "Search",
      type: "text",
      // @ts-expect-error `inAddress` is required, so this property alone can't stand in for it.
      inAdress: false,
    };
    expect(missing.name).toBe("search");
  });
});
