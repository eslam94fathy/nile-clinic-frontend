import {
  act,
  cleanup,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { Activity, type ReactNode, StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiResult } from "@/lib/api/api-error";
import { messagesByLocale } from "@/test-support/render-with-intl";
import type { AuditPage } from "./types";
import { positionRefused, useAuditSearch } from "./use-audit-search";

const { searchAuditEntries, refresh } = vi.hoisted(() => ({
  searchAuditEntries: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("./api/audit", () => ({ searchAuditEntries }));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const page = (
  next: string | null,
  prev: string | null,
  ...ids: number[]
): ApiResult<AuditPage> => ({
  ok: true,
  status: 200,
  data: {
    data: ids.map((id) => ({
      id,
      occurred_at: "2026-11-05T14:22:31.000000Z",
      action: "auth.sign_in",
      outcome: "succeeded",
      actor: {
        type: "staff",
        id: 1,
        name: "Synthetic Admin",
        role: "administrator",
      },
      subject: { type: "staff_member", id: 1 },
      patient_id: null,
      network_address: "203.0.113.10",
      changes: null,
      filters: null,
    })),
    meta: { per_page: 25, next_cursor: next, prev_cursor: prev },
  },
});
const failure = (
  status: number,
  fieldErrors: Record<string, string[]> = {},
): ApiResult<AuditPage> => ({ ok: false, error: { status, fieldErrors } });

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messagesByLocale.en}>
      {children}
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  searchAuditEntries.mockReset();
  searchAuditEntries.mockResolvedValue(page("c2", null, 3, 2));
  refresh.mockClear();
});
afterEach(cleanup);

const settled = async (result: {
  current: ReturnType<typeof useAuditSearch>;
}) => waitFor(() => expect(result.current.state.kind).not.toBe("reading"));

describe("reading only on a press", () => {
  it("reads nothing on mounting, re-rendering, focus, or visibility", () => {
    const { rerender } = renderHook(() => useAuditSearch(), { wrapper });
    rerender();
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("online"));

    expect(searchAuditEntries).not.toHaveBeenCalled();
  });

  it("reads nothing under Strict Mode's repeat", () => {
    renderHook(() => useAuditSearch(), {
      wrapper: ({ children }) => (
        <StrictMode>{wrapper({ children })}</StrictMode>
      ),
    });
    expect(searchAuditEntries).not.toHaveBeenCalled();
  });

  it("reads nothing when a held page is shown again, and keeps its results", async () => {
    let search: ReturnType<typeof useAuditSearch> | null = null;
    function Probe() {
      search = useAuditSearch();
      return <p>{search.state.kind}</p>;
    }
    const tree = (mode: "visible" | "hidden") =>
      wrapper({
        children: (
          <Activity mode={mode}>
            <Probe />
          </Activity>
        ),
      });
    const view = render(tree("visible"));

    act(() => search?.search({}));
    await waitFor(() => expect(view.container.textContent).toBe("shown"));
    view.rerender(tree("hidden"));
    view.rerender(tree("visible"));

    expect(searchAuditEntries).toHaveBeenCalledOnce();
    expect(view.container.textContent).toBe("shown");
  });

  it("reads once for Search, and once for two quick presses", async () => {
    const { result } = renderHook(() => useAuditSearch(), { wrapper });

    act(() => {
      result.current.search({ patient_id: 12 });
      result.current.search({ patient_id: 12 });
    });
    await settled(result);

    expect(searchAuditEntries).toHaveBeenCalledOnce();
    expect(searchAuditEntries).toHaveBeenCalledWith(
      { patient_id: 12 },
      null,
      "en",
    );
  });

  it("goes from idle to reading to shown", async () => {
    const { result } = renderHook(() => useAuditSearch(), { wrapper });
    expect(result.current.state.kind).toBe("idle");

    act(() => result.current.search({}));
    expect(result.current.state.kind).toBe("reading");
    expect(result.current.busy).toBe("search");
    await settled(result);

    const { state } = result.current;
    expect(state.kind === "shown" && state.shown.page.data).toHaveLength(2);
    expect(state.kind === "shown" && state.shown.newest).toBe(true);
    expect(result.current.busy).toBeNull();
  });

  it("shows an empty page as shown, with no entries", async () => {
    searchAuditEntries.mockResolvedValueOnce(page(null, null));
    const { result } = renderHook(() => useAuditSearch(), { wrapper });
    act(() => result.current.search({ staff_id: 999 }));
    await settled(result);

    const { state } = result.current;
    expect(state.kind === "shown" && state.shown.page.data).toEqual([]);
  });
});

describe("after a failure", () => {
  it.each([500, 0])(
    "fails with %s, and Try again reads once more with the same filters",
    async (status) => {
      searchAuditEntries.mockResolvedValueOnce(failure(status));
      const { result } = renderHook(() => useAuditSearch(), { wrapper });

      act(() => result.current.search({ outcome: "refused" }));
      await settled(result);
      expect(result.current.state.kind).toBe("failed");
      expect(searchAuditEntries).toHaveBeenCalledOnce();

      act(() => result.current.retry());
      await settled(result);
      expect(searchAuditEntries).toHaveBeenCalledTimes(2);
      expect(searchAuditEntries).toHaveBeenLastCalledWith(
        { outcome: "refused" },
        null,
        "en",
      );
      expect(result.current.state.kind).toBe("shown");
    },
  );

  it("forgets everything on a 403, keeps nothing to try again, and lets the page re-decide", async () => {
    const { result } = renderHook(() => useAuditSearch(), { wrapper });
    act(() => result.current.search({ patient_id: 12 }));
    await settled(result);

    searchAuditEntries.mockResolvedValueOnce(failure(403));
    act(() => result.current.older());
    await settled(result);
    const { state } = result.current;
    expect(state.kind === "failed" && state.error.status).toBe(403);
    expect(state.kind === "failed" && state.previous).toBeNull();

    expect(refresh).toHaveBeenCalledOnce();
    act(() => result.current.retry());
    expect(searchAuditEntries).toHaveBeenCalledTimes(2);
  });

  it("keeps the results shown when a new search is refused on a field", async () => {
    const { result } = renderHook(() => useAuditSearch(), { wrapper });
    act(() => result.current.search({}));
    await settled(result);

    searchAuditEntries.mockResolvedValueOnce(failure(422, { to: ["Bad."] }));
    act(() => result.current.search({ from: "2026-11-05", to: "2026-11-01" }));
    await settled(result);

    const { state } = result.current;
    expect(state.kind).toBe("failed");
    expect(state.kind === "failed" && state.previous?.page.data).toHaveLength(
      2,
    );
  });
});

describe("paging", () => {
  async function onFirstPage() {
    const hook = renderHook(() => useAuditSearch(), { wrapper });
    act(() => hook.result.current.search({ patient_id: 12 }));
    await settled(hook.result);
    return hook;
  }

  it("sends the filters shown with each cursor", async () => {
    const { result } = await onFirstPage();

    searchAuditEntries.mockResolvedValueOnce(page("c3", "c1", 1));
    act(() => result.current.older());
    await settled(result);
    expect(searchAuditEntries).toHaveBeenLastCalledWith(
      { patient_id: 12 },
      "c2",
      "en",
    );

    searchAuditEntries.mockResolvedValueOnce(page("c2", null, 3, 2));
    act(() => result.current.newer());
    await settled(result);
    expect(searchAuditEntries).toHaveBeenLastCalledWith(
      { patient_id: 12 },
      "c1",
      "en",
    );
    expect(searchAuditEntries).toHaveBeenCalledTimes(3);
  });

  it("keeps the page shown while moving, and reads once for two presses", async () => {
    const { result } = await onFirstPage();

    act(() => {
      result.current.older();
      result.current.older();
    });
    const { state } = result.current;
    expect(state.kind === "reading" && state.previous?.page.data).toHaveLength(
      2,
    );
    expect(result.current.busy).toBe("older");
    await settled(result);
    expect(searchAuditEntries).toHaveBeenCalledTimes(2);
  });

  it("doesn't move where there's nothing", async () => {
    searchAuditEntries.mockResolvedValueOnce(page(null, null, 1));
    const { result } = renderHook(() => useAuditSearch(), { wrapper });
    act(() => result.current.search({}));
    await settled(result);

    act(() => {
      result.current.older();
      result.current.newer();
    });
    expect(searchAuditEntries).toHaveBeenCalledOnce();
  });

  it("keeps the page when a move fails, and Try again repeats the same move", async () => {
    const { result } = await onFirstPage();

    searchAuditEntries.mockResolvedValueOnce(failure(500));
    act(() => result.current.older());
    await settled(result);
    const { state } = result.current;
    expect(state.kind === "failed" && state.move).toBe("older");
    expect(state.kind === "failed" && state.previous?.page.data).toHaveLength(
      2,
    );

    act(() => result.current.retry());
    await settled(result);
    expect(searchAuditEntries).toHaveBeenLastCalledWith(
      { patient_id: 12 },
      "c2",
      "en",
    );
  });

  it("starts again from the newest after a refused position", async () => {
    const { result } = await onFirstPage();

    searchAuditEntries.mockResolvedValueOnce(
      failure(422, { cursor: ["Invalid."] }),
    );
    act(() => result.current.older());
    await settled(result);
    const { state } = result.current;
    expect(state.kind === "failed" && positionRefused(state.error)).toBe(true);

    act(() => result.current.startAgain());
    await settled(result);
    expect(searchAuditEntries).toHaveBeenLastCalledWith(
      { patient_id: 12 },
      null,
      "en",
    );
  });
});

describe("clear", () => {
  it("forgets without reading, and ignores a read still on its way", async () => {
    let resolve: (value: ApiResult<AuditPage>) => void = () => {};
    searchAuditEntries.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { result } = renderHook(() => useAuditSearch(), { wrapper });

    act(() => result.current.search({}));
    act(() => result.current.clear());
    await act(async () => resolve(page(null, null, 1)));

    expect(result.current.state.kind).toBe("idle");
    expect(searchAuditEntries).toHaveBeenCalledOnce();
  });
});
