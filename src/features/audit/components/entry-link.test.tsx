import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test-support/render-with-intl";
import { EntryLink } from "./entry-link";

const { markAsked } = vi.hoisted(() => ({ markAsked: vi.fn() }));

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
}));
vi.mock("@/features/patients/public", () => ({
  PatientLink: ({
    id,
    children,
  }: {
    id: number;
    children: React.ReactNode;
  }) => (
    <a
      href={`/patients/${String(id)}`}
      data-audited="true"
      onClick={() => markAsked(id)}
    >
      {children}
    </a>
  ),
}));

afterEach(cleanup);

const link = () => screen.getByRole("link");

describe("EntryLink", () => {
  it("links a patient only through the audited link", () => {
    renderWithIntl(<EntryLink type="patient" id={12} />);
    expect(link().getAttribute("href")).toBe("/patients/12");
    expect(link().getAttribute("data-audited")).toBe("true");
    expect(markAsked).not.toHaveBeenCalled();
  });

  it.each([
    ["staff_member", "/staff/3"],
    ["doctor", "/doctors/3"],
    ["appointment", "/appointments/3"],
    ["charge", "/charges/3"],
  ] as const)("links a %s to %s, with no prefetch", (type, href) => {
    renderWithIntl(<EntryLink type={type} id={3} />);
    expect(link().getAttribute("href")).toBe(href);
    expect(link().getAttribute("data-prefetch")).toBe("false");
    expect(link().textContent).toBe("3");
  });

  it.each(["specialty", "time_off", "visit", "encounter"] as const)(
    "shows a %s's number as text",
    (type) => {
      const { container } = renderWithIntl(<EntryLink type={type} id={9} />);
      expect(screen.queryByRole("link")).toBeNull();
      expect(container.textContent).toBe("9");
    },
  );

  it("shows its own text when given", () => {
    renderWithIntl(
      <EntryLink type="staff_member" id={3}>
        {"Synthetic Admin"}
      </EntryLink>,
    );
    expect(link().textContent).toBe("Synthetic Admin");
  });
});
