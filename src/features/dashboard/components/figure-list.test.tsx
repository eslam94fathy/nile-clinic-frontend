import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test-support/render-with-intl";
import { FigureList } from "./figure-list";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
}));

afterEach(cleanup);

describe("FigureList", () => {
  it("shows each label beside its count, zero as a figure", () => {
    renderWithIntl(
      <FigureList
        figures={[
          { id: "a", label: "Waiting", value: 0 },
          { id: "b", label: "Seen", value: 1234 },
        ]}
      />,
    );
    expect(screen.getByText("Waiting").nextSibling?.textContent).toBe("0");
    expect(screen.getByText("Seen").nextSibling?.textContent).toBe("1,234");
  });

  it("names a linked figure by what it counts", () => {
    renderWithIntl(
      <FigureList
        figures={[
          {
            id: "a",
            label: "Unpaid",
            value: 2,
            href: "/billing?charge_status=unpaid",
          },
        ]}
      />,
    );
    const link = screen.getByRole("link", { name: "Unpaid: 2" });
    expect(link.getAttribute("href")).toBe("/billing?charge_status=unpaid");
    expect(link.getAttribute("data-prefetch")).toBe("false");
  });

  it("keeps Western digits, isolated, in Arabic", () => {
    renderWithIntl(
      <FigureList figures={[{ id: "a", label: "x", value: 12 }]} />,
      "ar",
    );
    const value = screen.getByText("12");
    expect(value.tagName).toBe("BDI");
  });
});
