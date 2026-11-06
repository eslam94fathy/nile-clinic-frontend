import { describe, expect, it } from "vitest";
import { readinessOf } from "./readiness";

const ready = {
  active: true,
  hasPeriods: true,
  slotCount: 40,
  hasFee: true,
} as const;

describe("readinessOf", () => {
  it("is complete with slots and a fee", () => {
    expect(readinessOf(ready)).toEqual({
      items: {
        account: "complete",
        hours: "complete",
        slots: "complete",
        fee: "complete",
      },
      bookable: true,
      setupComplete: true,
      chargeWarning: false,
    });
  });

  it("is bookable with slots and no fee, with the warning, but not complete", () => {
    const result = readinessOf({ ...ready, hasFee: false });

    expect(result.bookable).toBe(true);
    expect(result.setupComplete).toBe(false);
    expect(result.chargeWarning).toBe(true);
    expect(result.items.fee).toBe("incomplete");
  });

  it("isn't bookable with a fee and no slots", () => {
    const result = readinessOf({ ...ready, slotCount: 0 });

    expect(result.bookable).toBe(false);
    expect(result.setupComplete).toBe(false);
    expect(result.chargeWarning).toBe(false);
    expect(result.items.slots).toBe("incomplete");
  });

  it("isn't bookable with working hours but no slots, as only slots decide", () => {
    const result = readinessOf({
      active: true,
      hasPeriods: true,
      slotCount: 0,
      hasFee: false,
    });

    expect(result.items.hours).toBe("complete");
    expect(result.bookable).toBe(false);
    expect(result.chargeWarning).toBe(false);
  });

  it("reports an inactive account, which would have no slots", () => {
    const result = readinessOf({ ...ready, active: false, slotCount: 0 });

    expect(result.items.account).toBe("incomplete");
    expect(result.bookable).toBe(false);
  });

  it("claims neither when slots couldn't be read", () => {
    const result = readinessOf({ ...ready, slotCount: "unknown" });

    expect(result.items.slots).toBe("unknown");
    expect(result.bookable).toBe("unknown");
    expect(result.setupComplete).toBe("unknown");
    expect(result.chargeWarning).toBe(false);
  });

  it("stays bookable when only the fee couldn't be read", () => {
    const result = readinessOf({ ...ready, hasFee: "unknown" });

    expect(result.bookable).toBe(true);
    expect(result.setupComplete).toBe("unknown");
    expect(result.items.fee).toBe("unknown");
    expect(result.chargeWarning).toBe(false);
  });

  it("isn't complete when known to have no slots, even if the fee is unknown", () => {
    const result = readinessOf({ ...ready, slotCount: 0, hasFee: "unknown" });

    expect(result.setupComplete).toBe(false);
  });

  it("isn't complete when known to have no fee, even if slots are unknown", () => {
    const result = readinessOf({
      ...ready,
      slotCount: "unknown",
      hasFee: false,
    });

    expect(result.setupComplete).toBe(false);
    expect(result.bookable).toBe("unknown");
  });

  it("doesn't let unknown hours affect bookability", () => {
    const result = readinessOf({ ...ready, hasPeriods: "unknown" });

    expect(result.items.hours).toBe("unknown");
    expect(result.bookable).toBe(true);
    expect(result.setupComplete).toBe(true);
  });
});
