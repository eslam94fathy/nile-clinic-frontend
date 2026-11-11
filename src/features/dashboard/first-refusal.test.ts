import { describe, expect, it } from "vitest";
import type { ApiResult } from "@/lib/api/api-error";
import { allSucceeded, firstRefusal } from "./first-refusal";

const ok = (data: number): ApiResult<number> => ({
  ok: true,
  status: 200,
  data,
});
const failed = (status: number): ApiResult<number> => ({
  ok: false,
  error: { status, fieldErrors: {} },
});

describe("allSucceeded", () => {
  it("is true only when every request succeeded", () => {
    expect(allSucceeded([ok(1), ok(2)])).toBe(true);
    expect(allSucceeded([ok(1), failed(500)])).toBe(false);
    expect(allSucceeded([])).toBe(true);
  });
});

describe("firstRefusal", () => {
  it.each([
    [[500, 404, 403], 403],
    [[404, 500], 404],
    [[403, 401], 401],
    [[500, 0], 500],
    [[0, 500], 0],
    [[422, 404], 404],
  ])(
    "chooses by 401, 403, 404, then the first other: %j → %i",
    (statuses, expected) => {
      const results = [ok(1), ...statuses.map(failed)];
      expect(firstRefusal(results).status).toBe(expected);
    },
  );

  it("keeps the chosen failure's message", () => {
    const results: ApiResult<number>[] = [
      {
        ok: false,
        error: { status: 403, message: "Not allowed.", fieldErrors: {} },
      },
    ];
    expect(firstRefusal(results).message).toBe("Not allowed.");
  });
});
