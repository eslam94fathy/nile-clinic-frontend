import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuditedLink } from "./audited-link";

const linkProps = vi.hoisted(() => vi.fn());
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({
    children,
    prefetch,
    ...props
  }: {
    children: ReactNode;
    prefetch?: boolean;
    href: string;
  }) => {
    linkProps(prefetch);
    return <a {...props}>{children}</a>;
  },
}));

afterEach(cleanup);

function setUp() {
  const onAsked = vi.fn();
  render(
    <AuditedLink href="/my/encounters/1" onAsked={onAsked}>
      Open
    </AuditedLink>,
  );
  // Stops jsdom trying to navigate, which it can't do.
  const link = screen.getByRole("link", { name: "Open" });
  link.addEventListener("click", (event) => event.preventDefault());
  return { link, onAsked };
}

describe("AuditedLink", () => {
  it("never prefetches", () => {
    setUp();
    expect(linkProps).toHaveBeenCalledWith(false);
  });

  it("says a person asked, on a plain click", () => {
    const { link, onAsked } = setUp();
    fireEvent.click(link);
    expect(onAsked).toHaveBeenCalledOnce();
  });

  it.each([
    ["ctrlKey", { ctrlKey: true }],
    ["metaKey", { metaKey: true }],
    ["shiftKey", { shiftKey: true }],
    ["altKey", { altKey: true }],
  ])("says nothing with %s, as another tab reads for itself", (_name, init) => {
    const { link, onAsked } = setUp();
    fireEvent.click(link, init);
    expect(onAsked).not.toHaveBeenCalled();
  });
});
