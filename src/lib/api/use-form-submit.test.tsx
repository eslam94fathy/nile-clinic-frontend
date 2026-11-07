import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFormSubmit } from "./use-form-submit";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("@/lib/i18n/navigation", () => ({ useRouter: () => router }));

afterEach(cleanup);

function setUp() {
  return renderHook(() =>
    useFormSubmit<{ note: string }>({
      fields: ["note"],
      setError: vi.fn(),
      generalFailure: "General",
    }),
  );
}

const refused = {
  ok: false as const,
  error: { status: 409, fieldErrors: {}, message: "Taken.", reason: "x" },
};

describe("useFormSubmit", () => {
  it("tells the caller about a failure, after showing it", async () => {
    const { result } = setUp();
    const onFailure = vi.fn();

    await act(() =>
      result.current.submit(() => Promise.resolve(refused), vi.fn(), onFailure),
    );

    expect(onFailure).toHaveBeenCalledWith(refused.error);
    expect(result.current.formErrors).toEqual(["Taken."]);
  });

  it("lets the caller replace what's shown", async () => {
    const { result } = setUp();

    await act(() =>
      result.current.submit(
        () => Promise.resolve(refused),
        vi.fn(),
        () => result.current.setFormErrors([]),
      ),
    );

    expect(result.current.formErrors).toEqual([]);
  });

  it("doesn't call it on success", async () => {
    const { result } = setUp();
    const onFailure = vi.fn();
    const onSuccess = vi.fn();

    await act(() =>
      result.current.submit(
        () => Promise.resolve({ ok: true as const, status: 200, data: 1 }),
        onSuccess,
        onFailure,
      ),
    );

    expect(onSuccess).toHaveBeenCalledWith(1);
    expect(onFailure).not.toHaveBeenCalled();
  });
});
