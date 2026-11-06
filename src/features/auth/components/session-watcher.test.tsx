import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionWatcher } from "./session-watcher";

afterEach(cleanup);

const stopFollowing = vi.hoisted(() => vi.fn());
const followSessionEndInOtherTabs = vi.hoisted(() =>
  vi.fn(() => stopFollowing),
);

vi.mock("@/lib/auth/session-end", () => ({ followSessionEndInOtherTabs }));

const reload = vi.fn();

function showPage(persisted: boolean) {
  const event = new Event("pageshow");
  Object.assign(event, { persisted });
  window.dispatchEvent(event);
}

beforeEach(() => {
  reload.mockClear();
  stopFollowing.mockClear();
  followSessionEndInOtherTabs.mockClear();
  vi.stubGlobal("location", { reload });
});

describe("SessionWatcher", () => {
  it("follows other tabs", () => {
    render(<SessionWatcher />);
    expect(followSessionEndInOtherTabs).toHaveBeenCalledTimes(1);
  });

  it("reloads a page restored from the back-forward cache", () => {
    render(<SessionWatcher />);
    showPage(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("doesn't reload an ordinary page load", () => {
    render(<SessionWatcher />);
    showPage(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("cleans up", () => {
    const { unmount } = render(<SessionWatcher />);
    unmount();
    showPage(true);

    expect(stopFollowing).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });
});
