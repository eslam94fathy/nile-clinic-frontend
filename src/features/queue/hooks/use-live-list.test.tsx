import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { type ReactNode, useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiResult } from "@/lib/api/api-error";
import { type LiveList, useLiveList } from "./use-live-list";

afterEach(cleanup);

const failure = (status: number): ApiResult<string[]> => ({
  ok: false,
  error: { status, fieldErrors: {}, message: `Refused ${status}.` },
});
const found = (...names: string[]): ApiResult<string[]> => ({
  ok: true,
  status: 200,
  data: names,
});

let latest: LiveList<string[]>;

function Reader({
  read,
  listKey,
}: {
  read: () => Promise<ApiResult<string[]>>;
  listKey: string;
}) {
  const list = useLiveList<string[]>({ queryKey: ["queue", listKey], read });
  useEffect(() => {
    latest = list;
  });
  return <p>{list.data?.join() ?? "nothing"}</p>;
}

function Stage({
  read,
  children,
}: {
  read: () => Promise<ApiResult<string[]>>;
  children?: ReactNode;
}) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retryDelay: 1 } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <Reader read={read} listKey="list" />
      {children}
    </QueryClientProvider>
  );
}

describe("useLiveList", () => {
  it("gives what it read, and when", async () => {
    const read = vi.fn().mockResolvedValue(found("Synthetic"));
    render(<Stage read={read} />);

    await screen.findByText("Synthetic");
    expect(latest.failure).toBeNull();
    expect(latest.outOfDate).toBe(false);
    expect(latest.readAt).toBeGreaterThan(0);
  });

  it("keeps the list, and says so, when a refresh fails", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(found("Synthetic"))
      .mockResolvedValue(failure(500));
    render(<Stage read={read} />);
    await screen.findByText("Synthetic");

    await act(() => latest.refresh());

    await waitFor(() => expect(latest.outOfDate).toBe(true));
    expect(latest.data).toEqual(["Synthetic"]);
    expect(latest.failure).toBeNull();
  });

  it("clears the notice when a later read succeeds", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(found("Synthetic"))
      .mockResolvedValueOnce(failure(500))
      .mockResolvedValueOnce(failure(500))
      .mockResolvedValue(found("Synthetic", "Second"));
    render(<Stage read={read} />);
    await screen.findByText("Synthetic");
    await act(() => latest.refresh());
    await waitFor(() => expect(latest.outOfDate).toBe(true));

    await act(() => latest.refresh());

    await screen.findByText("Synthetic,Second");
    expect(latest.outOfDate).toBe(false);
  });

  it("gives the failure when there's nothing to show", async () => {
    const read = vi.fn().mockResolvedValue(failure(500));
    render(<Stage read={read} />);

    await waitFor(() => expect(latest.failure?.status).toBe(500));
    expect(latest.data).toBeUndefined();
  });

  it("retries a server error once, and never a refusal", async () => {
    const server = vi.fn().mockResolvedValue(failure(500));
    const { unmount } = render(<Stage read={server} />);
    await waitFor(() => expect(latest.failure?.status).toBe(500));
    expect(server).toHaveBeenCalledTimes(2);
    unmount();

    const refusal = vi.fn().mockResolvedValue(failure(403));
    render(<Stage read={refusal} />);
    await waitFor(() => expect(latest.failure?.status).toBe(403));
    expect(refusal).toHaveBeenCalledTimes(1);
  });

  it.each([403, 404])("removes the data on a %i, and stops", async (status) => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(found("Synthetic"))
      .mockResolvedValue(failure(status));
    render(<Stage read={read} />);
    await screen.findByText("Synthetic");

    await act(() => latest.refresh());

    await screen.findByText("nothing");
    expect(latest.failure?.status).toBe(status);
    expect(latest.readAt).toBe(0);

    const calls = read.mock.calls.length;
    // A tab regaining focus is what would otherwise read again.
    fireEvent(window, new Event("visibilitychange"));
    await act(() => latest.refresh());
    expect(read).toHaveBeenCalledTimes(calls);
  });
});
