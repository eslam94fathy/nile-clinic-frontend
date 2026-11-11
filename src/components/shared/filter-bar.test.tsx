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

describe("private searches", () => {
  const search: FilterDefinition[] = [
    { name: "phone", label: "Phone", type: "text", inAddress: false },
  ];

  it("shows an error on its field", () => {
    renderWithIntl(
      <FilterBar filters={search} errors={{ phone: "The phone is bad." }} />,
    );
    const field = screen.getByLabelText("Phone");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("The phone is bad.");
  });

  it("asks the browser not to remember a private filter", () => {
    renderWithIntl(<FilterBar filters={search} />);
    expect(screen.getByLabelText("Phone").getAttribute("autocomplete")).toBe(
      "off",
    );
  });

  it("leaves a filter in the address as it was", () => {
    renderWithIntl(<FilterBar filters={filters} />);
    expect(
      screen.getByLabelText("Date").getAttribute("autocomplete"),
    ).toBeNull();
  });

  it("can name its button", () => {
    renderWithIntl(<FilterBar filters={search} applyLabel="Search" />);
    expect(screen.getByRole("button", { name: "Search" })).toBeTruthy();
  });

  it("tells a reset from an empty search", () => {
    const onApply = vi.fn();
    const onReset = vi.fn();
    renderWithIntl(
      <FilterBar filters={search} onApply={onApply} onReset={onReset} />,
    );

    fireEvent.click(screen.getByRole("button", { name: text.reset }));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });
});

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

describe("a filter with a default", () => {
  const dated: FilterDefinition[] = [
    {
      name: "from",
      label: "From",
      type: "text",
      inAddress: true,
      defaultValue: "2026-11-07",
    },
  ];

  it("shows the default when the address has none", () => {
    renderWithIntl(<FilterBar filters={dated} />);
    expect(screen.getByLabelText<HTMLInputElement>("From").value).toBe(
      "2026-11-07",
    );
  });

  it("prefers the address", () => {
    query = "from=2026-01-01";
    renderWithIntl(<FilterBar filters={dated} />);
    expect(screen.getByLabelText<HTMLInputElement>("From").value).toBe(
      "2026-01-01",
    );
  });

  it("restores the default on reset", () => {
    query = "from=2026-01-01";
    renderWithIntl(<FilterBar filters={dated} />);
    fireEvent.click(screen.getByRole("button", { name: text.reset }));
    expect(screen.getByLabelText<HTMLInputElement>("From").value).toBe(
      "2026-11-07",
    );
    expect(push).toHaveBeenCalledWith("/visits");
  });

  it("follows a default that changes", () => {
    const { rerender } = renderWithIntl(<FilterBar filters={dated} />);
    rerender(
      <NextIntlClientProvider
        locale="en"
        messages={messagesByLocale.en}
        timeZone="Africa/Cairo"
      >
        <FilterBar
          filters={[
            {
              name: "from",
              label: "From",
              type: "text",
              inAddress: true,
              defaultValue: "2026-12-25",
            },
          ]}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByLabelText<HTMLInputElement>("From").value).toBe(
      "2026-12-25",
    );
  });
});

describe("a bar with only private filters", () => {
  const search: FilterDefinition[] = [
    { name: "phone", label: "Phone", type: "text", inAddress: false },
  ];

  it("leaves the address alone, including the list behind it's page", () => {
    query = "page=3";
    const onApply = vi.fn();
    renderWithIntl(<FilterBar filters={search} onApply={onApply} />);

    apply();
    fireEvent.click(screen.getByRole("button", { name: text.reset }));

    expect(push).not.toHaveBeenCalled();
    expect(onApply).toHaveBeenCalled();
  });
});

describe("option groups", () => {
  const grouped: FilterDefinition[] = [
    {
      name: "action",
      label: "Action",
      type: "select",
      inAddress: false,
      options: [
        { value: "", label: "Any" },
        { value: "a.one", label: "One", group: "First" },
        { value: "a.two", label: "Two", group: "First" },
        { value: "b.one", label: "Three", group: "Second" },
      ],
    },
  ];

  it("puts consecutive options of a group in one optgroup, and leaves others alone", () => {
    renderWithIntl(<FilterBar filters={grouped} />);
    const select = screen.getByLabelText("Action");
    const groups = select.querySelectorAll("optgroup");

    expect([...groups].map((group) => group.label)).toEqual([
      "First",
      "Second",
    ]);
    expect(groups[0]?.querySelectorAll("option")).toHaveLength(2);
    expect(select.querySelector(":scope > option")?.textContent).toBe("Any");
  });

  it("sends a grouped option's value", () => {
    const onApply = vi.fn();
    renderWithIntl(<FilterBar filters={grouped} onApply={onApply} />);
    type("Action", "a.two");
    apply();

    expect(onApply).toHaveBeenCalledWith({ action: "a.two" });
  });
});

describe("labels", () => {
  it("can name its buttons for the screen", () => {
    renderWithIntl(
      <FilterBar
        filters={[{ name: "q", label: "Q", type: "text", inAddress: false }]}
        applyLabel="Search"
        resetLabel="Clear"
      />,
    );
    expect(screen.getByRole("button", { name: "Search" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Clear" })).toBeTruthy();
  });
});

describe("watching and blocking", () => {
  it("reports every value, trimmed, on each change, without applying", () => {
    const onChange = vi.fn();
    const onApply = vi.fn();
    renderWithIntl(
      <FilterBar filters={filters} onChange={onChange} onApply={onApply} />,
    );
    type("Search", " 0100 ");
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "seen" },
    });

    expect(onChange).toHaveBeenLastCalledWith({
      date: "",
      status: "seen",
      search: "0100",
    });
    expect(onApply).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("says applying is unavailable while blocked, and ignores a press", () => {
    const onApply = vi.fn();
    renderWithIntl(
      <FilterBar filters={filters} onApply={onApply} applyBlocked />,
    );
    type("Date", "2026-11-05");
    apply();

    const button = screen.getByRole("button", { name: text.apply });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button).toHaveProperty("disabled", false);
    expect(onApply).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
