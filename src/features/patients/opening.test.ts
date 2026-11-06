import { afterEach, describe, expect, it, vi } from "vitest";
import {
  changeCount,
  handOver,
  markAsked,
  noteChange,
  takeAsked,
  takeHandedOver,
} from "./opening";
import type { Patient } from "./types";

const record: Patient = {
  id: 5,
  full_name: "Synthetic Patient",
  sex: "female",
  date_of_birth: "1990-04-12",
  phone: "01000000001",
  national_id: null,
  address: null,
  emergency_contact: null,
  created_at: "2026-02-01T10:00:00.000000Z",
  updated_at: "2026-02-01T10:00:00.000000Z",
};

describe("a handed-over record", () => {
  it("is taken once", () => {
    handOver(record);
    expect(takeHandedOver(5)).toBe(record);
    expect(takeHandedOver(5)).toBeNull();
  });

  it("is only for its own patient, and stays for it", () => {
    handOver(record);
    expect(takeHandedOver(6)).toBeNull();
    expect(takeHandedOver(5)).toBe(record);
  });

  it("is nothing when none was handed over", () => {
    expect(takeHandedOver(5)).toBeNull();
  });
});

describe("an asked-for mark", () => {
  it("is used up by taking it", () => {
    markAsked(5);
    expect(takeAsked(5)).toBe(true);
    expect(takeAsked(5)).toBe(false);
  });

  it("belongs to one patient", () => {
    markAsked(5);
    expect(takeAsked(6)).toBe(false);
    expect(takeAsked(5)).toBe(true);
  });
});

describe("the change counter", () => {
  it("goes up with each change", () => {
    const before = changeCount();
    noteChange();
    noteChange();
    expect(changeCount()).toBe(before + 2);
  });
});

describe("what an overtaken navigation leaves behind", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("doesn't count as asking, once it's old", () => {
    vi.useFakeTimers();
    markAsked(70);
    vi.advanceTimersByTime(14_000);
    expect(takeAsked(70)).toBe(true);

    markAsked(70);
    vi.advanceTimersByTime(15_000);
    expect(takeAsked(70)).toBe(false);
    expect(takeAsked(70)).toBe(false);
  });

  it("doesn't stand in for a read, once it's old", () => {
    vi.useFakeTimers();
    handOver(record);
    vi.advanceTimersByTime(15_000);

    expect(takeHandedOver(record.id)).toBeNull();
  });
});
