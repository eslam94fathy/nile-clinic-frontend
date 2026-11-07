import { describe, expect, it } from "vitest";
import { offeredOwnAction } from "./offered-own-action";
import type { QueueStatus } from "./types";

const rows = (...statuses: QueueStatus[]) =>
  statuses.map((status) => ({ status }));

describe("offeredOwnAction", () => {
  it("offers nothing on an empty list", () => {
    expect(offeredOwnAction([])).toBeNull();
  });

  it("offers finishing while someone is with the doctor, even with others waiting", () => {
    expect(offeredOwnAction(rows("with_doctor"))).toBe("finish");
    expect(offeredOwnAction(rows("waiting", "with_doctor", "seen"))).toBe(
      "finish",
    );
  });

  it("offers calling when someone is waiting and nobody is with the doctor", () => {
    expect(offeredOwnAction(rows("seen", "waiting", "left"))).toBe("call_next");
  });

  it("offers nothing when everyone has been seen or left", () => {
    expect(offeredOwnAction(rows("seen", "left"))).toBeNull();
  });
});
