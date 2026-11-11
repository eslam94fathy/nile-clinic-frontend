import { cleanup, fireEvent, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiError } from "@/lib/api/api-error";
import type { LiveList } from "@/lib/api/use-live-list";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { DashboardPanel } from "./dashboard-panel";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
}));
const SessionEndRedirect = vi.hoisted(() => vi.fn(() => <p>leaving</p>));
vi.mock("@/features/auth/public", () => ({ SessionEndRedirect }));

afterEach(cleanup);

const states = messagesByLocale.en.shared.states;
const lastRead = messagesByLocale.en.shared.lastRead;

function aList(
  changes: Partial<LiveList<{ count: number }>> = {},
): LiveList<{ count: number }> {
  return {
    data: undefined,
    failure: null,
    outOfDate: false,
    reading: false,
    readAt: 0,
    refresh: vi.fn(() => Promise.resolve()),
    ...changes,
  };
}
const failure = (status: number, message?: string): ApiError => ({
  status,
  fieldErrors: {},
  ...(message ? { message } : {}),
});

function renderPanel(
  list: LiveList<{ count: number }>,
  extra: { readsBySelf?: boolean; notFound?: ReactNode } = {},
  locale: "en" | "ar" = "en",
) {
  return renderWithIntl(
    <DashboardPanel
      panel="sample"
      heading="Sample panel"
      link={{ href: "/queue", label: "Open the queue" }}
      list={list}
      timeZone="Africa/Cairo"
      readsBySelf
      {...extra}
    >
      {(data) => <p>Count {data.count}</p>}
    </DashboardPanel>,
    locale,
  );
}

describe("DashboardPanel", () => {
  it("is a section named by its heading, with an unprefetched link to the screen that owns it", () => {
    renderPanel(
      aList({ data: { count: 3 }, readAt: Date.UTC(2026, 10, 11, 8) }),
    );

    expect(screen.getByRole("region", { name: "Sample panel" })).toBeTruthy();
    const link = screen.getByRole("link", { name: "Open the queue" });
    expect(link.getAttribute("href")).toBe("/queue");
    expect(link.getAttribute("data-prefetch")).toBe("false");
    expect(screen.getByText("Count 3")).toBeTruthy();
    expect(screen.getByText(lastRead.label)).toBeTruthy();
  });

  it("shows loading until the first read", () => {
    renderPanel(aList());
    expect(screen.getByText(states.loading)).toBeTruthy();
    expect(screen.queryByRole("button", { name: lastRead.refresh })).toBeNull();
  });

  it("says it failed, with the API's message, and Try again reads it again", () => {
    const list = aList({ failure: failure(500, "The server had a problem.") });
    renderPanel(list);

    expect(screen.getByRole("alert").textContent).toContain(
      "The server had a problem.",
    );
    fireEvent.click(screen.getByRole("button", { name: states.retry }));
    expect(list.refresh).toHaveBeenCalledOnce();
  });

  it("uses its own words when a failure has no message", () => {
    renderPanel(aList({ failure: failure(0) }));
    expect(
      screen.getByText(messagesByLocale.en.dashboard.panel.failed),
    ).toBeTruthy();
  });

  it("keeps figures already shown when a later read fails, saying they may be out of date", () => {
    renderPanel(aList({ data: { count: 3 }, outOfDate: true, readAt: 1 }));
    expect(screen.getByText("Count 3")).toBeTruthy();
    expect(screen.getByText(lastRead.outOfDate)).toBeTruthy();
  });

  it("doesn't promise a retry by itself on a panel read only when asked", () => {
    renderPanel(aList({ data: { count: 3 }, outOfDate: true, readAt: 1 }), {
      readsBySelf: false,
    });
    expect(screen.getByText(lastRead.outOfDateOnDemand)).toBeTruthy();
  });

  it("shows the forbidden state for a 403, with nothing from before", () => {
    renderPanel(aList({ failure: failure(403) }));
    expect(screen.getByText(states.forbiddenHeading)).toBeTruthy();
    expect(screen.queryByText(/Count/)).toBeNull();
  });

  it("shows the not-found state for a 404, or the panel's own words for it", () => {
    renderPanel(aList({ failure: failure(404) }));
    expect(screen.getByText(states.notFoundHeading)).toBeTruthy();
    cleanup();

    renderPanel(aList({ failure: failure(404) }), {
      notFound: <p>Profile gone</p>,
    });
    expect(screen.getByText("Profile gone")).toBeTruthy();
  });

  it("follows the session's end on a 401", () => {
    renderPanel(aList({ failure: failure(401) }));
    expect(screen.getByText("leaving")).toBeTruthy();
  });

  it("works in Arabic", () => {
    renderPanel(aList({ failure: failure(0) }), {}, "ar");
    expect(
      screen.getByText(messagesByLocale.ar.dashboard.panel.failed),
    ).toBeTruthy();
  });
});
