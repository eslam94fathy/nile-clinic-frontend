import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LIVE_QUERY } from "@/lib/api/live-query";
import { usePanel } from "./use-panel";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient();
  return (
    <NextIntlClientProvider locale="ar" messages={{}}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </NextIntlClientProvider>
  );
}

describe("usePanel", () => {
  it("reads the clinic's new date after midnight in its time zone, not the computer's", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // 21:59:50 UTC on 10 November is 23:59:50 in Cairo.
    vi.setSystemTime(new Date("2026-11-10T21:59:50Z"));
    const read = vi.fn((today: string, locale: string) =>
      Promise.resolve({
        ok: true as const,
        status: 200,
        data: { today, locale },
      }),
    );

    const { result } = renderHook(
      () =>
        usePanel({
          panel: "sample",
          read,
          timeZone: "Africa/Cairo",
          policy: LIVE_QUERY,
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.data?.today).toBe("2026-11-10"));
    expect(result.current.data?.locale).toBe("ar");

    // The next interval falls after midnight in Cairo, though it's still 10 November in UTC.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    await waitFor(() => expect(result.current.data?.today).toBe("2026-11-11"));
    expect(read.mock.calls.map(([today]) => today)).toEqual([
      "2026-11-10",
      "2026-11-11",
    ]);
  });

  it("refreshes only its own panel", async () => {
    const client = new QueryClient();
    const own = vi.fn(() =>
      Promise.resolve({ ok: true as const, status: 200, data: 1 }),
    );
    const other = vi.fn(() =>
      Promise.resolve({ ok: true as const, status: 200, data: 2 }),
    );
    const twoPanels = ({ children }: { children: ReactNode }) => (
      <NextIntlClientProvider locale="en" messages={{}}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    );
    const { result } = renderHook(
      () => ({
        own: usePanel({
          panel: "own",
          read: own,
          timeZone: "Africa/Cairo",
          policy: LIVE_QUERY,
        }),
        other: usePanel({
          panel: "other",
          read: other,
          timeZone: "Africa/Cairo",
          policy: LIVE_QUERY,
        }),
      }),
      { wrapper: twoPanels },
    );
    await waitFor(() => expect(result.current.other.data).toBe(2));

    await act(() => result.current.own.refresh());
    expect(own).toHaveBeenCalledTimes(2);
    expect(other).toHaveBeenCalledTimes(1);
  });
});
