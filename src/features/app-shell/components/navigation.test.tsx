import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotFoundState } from "@/components/shared/states/not-found-state";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { Navigation } from "./navigation";

afterEach(cleanup);

const pathname = vi.hoisted(() => ({ value: "/queue" }));

vi.mock("@/lib/i18n/navigation", () => ({
  usePathname: () => pathname.value,
  Link: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const items = [
  { path: "dashboard", label: "Dashboard" },
  { path: "queue", label: "Queue" },
  { path: "my/queue", label: "My queue" },
];

function setup() {
  renderWithIntl(<Navigation items={items} label="Main" menuLabel="Menu" />);
  return screen.getByRole("navigation", { name: "Main" });
}

describe("Navigation", () => {
  it("lists its items in order", () => {
    pathname.value = "/dashboard";
    const links = within(setup()).getAllByRole("link", { hidden: true });

    expect(links.map((link) => link.textContent)).toEqual([
      "Dashboard",
      "Queue",
      "My queue",
    ]);
    expect(links[2]?.getAttribute("href")).toBe("/my/queue");
  });

  it("marks only the current page, without relying on color", () => {
    pathname.value = "/queue";
    const nav = setup();

    const current = within(nav).getByRole("link", {
      name: "Queue",
      hidden: true,
    });
    expect(current.getAttribute("aria-current")).toBe("page");
    expect(current.className).toContain("font-semibold");
    expect(current.className).toContain("border-primary");
    expect(
      within(nav)
        .getByRole("link", { name: "My queue", hidden: true })
        .getAttribute("aria-current"),
    ).toBeNull();
  });

  it("marks a section from a page inside it", () => {
    pathname.value = "/queue/5";
    expect(
      within(setup())
        .getByRole("link", { name: "Queue", hidden: true })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  it("opens and closes its narrow-screen menu", () => {
    pathname.value = "/dashboard";
    const nav = setup();
    const button = within(nav).getByRole("button", { name: "Menu" });
    const list = within(nav).getByRole("list", { hidden: true });

    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(list.className.split(" ")).toContain("hidden");

    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(list.className.split(" ")).toContain("flex");

    fireEvent.click(within(nav).getByRole("link", { name: "Queue" }));
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("NotFoundState", () => {
  it("doesn't imply whether a record exists (FR-020)", () => {
    const { shared } = messagesByLocale.en;
    renderWithIntl(<NotFoundState />);

    expect(screen.getByText(shared.states.notFoundHeading)).toBeTruthy();
    expect(shared.states.notFoundDescription).not.toMatch(
      /deleted|exists|record/i,
    );
  });
});
