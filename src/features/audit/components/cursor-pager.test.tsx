import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { CursorPager } from "./cursor-pager";

afterEach(cleanup);

const text = messagesByLocale.en.shared.cursorPager;

function pager(props: Partial<Parameters<typeof CursorPager>[0]> = {}) {
  const onNewer = vi.fn();
  const onOlder = vi.fn();
  renderWithIntl(
    <CursorPager
      hasNewer
      hasOlder
      onNewer={onNewer}
      onOlder={onOlder}
      busy={null}
      atNewest={false}
      {...props}
    />,
  );
  return { onNewer, onOlder };
}

const button = (name: string) => screen.getByRole("button", { name });

describe("CursorPager", () => {
  it("offers Newer then Older, in reading order, and calls each", () => {
    const { onNewer, onOlder } = pager();
    const nav = screen.getByRole("navigation", { name: text.label });
    const names = within(nav)
      .getAllByRole("button")
      .map((each) => each.textContent);

    expect(names).toEqual([text.newer, text.older]);
    fireEvent.click(button(text.newer));
    fireEvent.click(button(text.older));
    expect(onNewer).toHaveBeenCalledTimes(1);
    expect(onOlder).toHaveBeenCalledTimes(1);
  });

  it("shows no total, page count, or page number", () => {
    pager();
    expect(screen.getByRole("navigation").textContent).not.toMatch(/\d/);
  });

  it("disables each end with nothing in its direction", () => {
    pager({ hasNewer: false, atNewest: true });
    expect(button(text.newer)).toHaveProperty("disabled", true);
    expect(button(text.older)).toHaveProperty("disabled", false);
    expect(screen.getByText(text.newest)).toBeTruthy();
  });

  it("disables both while one moves, and shows progress on the one pressed", () => {
    pager({ busy: "older" });
    const moving = button(text.moving);

    expect(moving.getAttribute("aria-busy")).toBe("true");
    expect(button(text.newer)).toHaveProperty("disabled", true);
    expect(moving).toHaveProperty("disabled", true);
  });

  it("says nothing of position away from the newest", () => {
    pager();
    expect(screen.queryByText(text.newest)).toBeNull();
  });

  it("works in Arabic, with the same order", () => {
    const ar = messagesByLocale.ar.shared.cursorPager;
    renderWithIntl(
      <CursorPager
        hasNewer
        hasOlder
        onNewer={vi.fn()}
        onOlder={vi.fn()}
        busy={null}
        atNewest={false}
      />,
      "ar",
    );
    const names = within(screen.getByRole("navigation"))
      .getAllByRole("button")
      .map((each) => each.textContent);
    expect(names).toEqual([ar.newer, ar.older]);
  });
});
