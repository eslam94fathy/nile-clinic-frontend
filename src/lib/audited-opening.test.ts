import { afterEach, describe, expect, it, vi } from "vitest";
import { createAuditedOpening } from "./audited-opening";

type Item = { id: number };

describe("createAuditedOpening", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps each feature's marks apart", () => {
    const first = createAuditedOpening<Item>();
    const second = createAuditedOpening<Item>();

    first.markAsked(1);
    expect(second.takeAsked(1)).toBe(false);
    expect(first.takeAsked(1)).toBe(true);
  });

  it("uses up a mark and a handover", () => {
    const opening = createAuditedOpening<Item>();
    const record = { id: 1 };

    opening.markAsked(1);
    opening.handOver(record);

    expect(opening.takeAsked(1)).toBe(true);
    expect(opening.takeAsked(1)).toBe(false);
    expect(opening.takeHandedOver(1)).toBe(record);
    expect(opening.takeHandedOver(1)).toBeNull();
  });

  it("forgets what's old, so the back button can't find it", () => {
    vi.useFakeTimers();
    const opening = createAuditedOpening<Item>();

    opening.markAsked(1);
    opening.handOver({ id: 1 });
    vi.advanceTimersByTime(15_000);

    expect(opening.takeAsked(1)).toBe(false);
    expect(opening.takeHandedOver(1)).toBeNull();
  });
});
