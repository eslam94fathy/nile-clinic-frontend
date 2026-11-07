import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiResult } from "@/lib/api/api-error";
import { useAuditedRead } from "./use-audited-read";

afterEach(cleanup);

type Data = { name: string };

const answer = (name: string): ApiResult<Data> => ({
  ok: true,
  status: 200,
  data: { name },
});
const refused = (status: number): ApiResult<Data> => ({
  ok: false,
  error: { status, fieldErrors: {} },
});

function setUp({
  read = vi.fn(() => Promise.resolve(answer("Read"))),
  asked = false,
  handedOver = null as Data | null,
  onFailure = vi.fn(),
  strict = false,
} = {}) {
  const takeAsked = vi.fn(() => asked);
  const takeHandedOver = vi.fn(() => handedOver);
  const hook = renderHook(
    () => useAuditedRead({ id: 1, read, takeAsked, takeHandedOver, onFailure }),
    strict ? { wrapper: StrictMode } : {},
  );
  return { ...hook, read, takeAsked, onFailure };
}

describe("useAuditedRead", () => {
  it("reads once on first being shown", async () => {
    const { result, read } = setUp();
    await waitFor(() => expect(result.current.data).toEqual({ name: "Read" }));
    expect(read).toHaveBeenCalledOnce();
  });

  it("reads once under Strict Mode's repeat", async () => {
    const { result, read } = setUp({ strict: true });
    await waitFor(() => expect(result.current.data).toEqual({ name: "Read" }));
    expect(read).toHaveBeenCalledOnce();
  });

  it("doesn't read for a re-render, or focus", async () => {
    const { result, rerender, read } = setUp();
    await waitFor(() => expect(result.current.data).not.toBeNull());

    rerender();
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("online"));

    expect(read).toHaveBeenCalledOnce();
  });

  it("doesn't read for a record handed over", async () => {
    const { result, read } = setUp({ handedOver: { name: "Handed" } });
    await waitFor(() =>
      expect(result.current.data).toEqual({ name: "Handed" }),
    );
    expect(read).not.toHaveBeenCalled();
  });

  it("reads when a person asks", async () => {
    const { result, read } = setUp();
    await waitFor(() => expect(result.current.data).not.toBeNull());

    await act(() => result.current.read());
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("removes what's held when the record can't be seen", async () => {
    const read = vi
      .fn<() => Promise<ApiResult<Data>>>()
      .mockResolvedValueOnce(answer("Read"))
      .mockResolvedValueOnce(refused(404));
    const { result, onFailure } = setUp({ read });
    await waitFor(() => expect(result.current.data).not.toBeNull());

    await act(() => result.current.read());
    expect(result.current.data).toBeNull();
    expect(result.current.failure?.status).toBe(404);
    expect(onFailure).toHaveBeenCalledOnce();
  });

  it("keeps what's held on another failure", async () => {
    const read = vi
      .fn<() => Promise<ApiResult<Data>>>()
      .mockResolvedValueOnce(answer("Read"))
      .mockResolvedValueOnce(refused(500));
    const { result } = setUp({ read });
    await waitFor(() => expect(result.current.data).not.toBeNull());

    await act(() => result.current.read());
    expect(result.current.data).toEqual({ name: "Read" });
    expect(result.current.failure?.status).toBe(500);
  });

  it("ignores an older answer once a change's answer has arrived", async () => {
    let finish: (value: ApiResult<Data>) => void = () => {};
    const read = vi.fn(
      () =>
        new Promise<ApiResult<Data>>((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = setUp({ read });

    act(() => result.current.replace({ name: "Saved" }));
    await act(async () => finish(answer("Old")));

    expect(result.current.data).toEqual({ name: "Saved" });
  });
});
