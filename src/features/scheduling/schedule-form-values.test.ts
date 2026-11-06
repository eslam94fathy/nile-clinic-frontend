import { describe, expect, it } from "vitest";
import { insertionIndex, scheduleToFormValues } from "./schedule-form-values";
import type { Schedule } from "./types";

const days = (
  entries: Partial<Record<string, { start: string; end: string }[]>>,
): Schedule["days"] =>
  (
    [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ] as const
  ).map((day) => ({ day, periods: entries[day] ?? [] }));

const base: Schedule = {
  doctor_id: 1,
  appointment_minutes: 20,
  days: days({}),
  updated_at: null,
};

describe("scheduleToFormValues", () => {
  it("flattens the days in order, keeping each day's periods in order", () => {
    const values = scheduleToFormValues({
      ...base,
      days: days({
        sunday: [
          { start: "09:00", end: "13:00" },
          { start: "17:00", end: "21:00" },
        ],
        tuesday: [{ start: "10:00", end: "24:00" }],
      }),
    });

    expect(values.periods).toEqual([
      { day: "sunday", start: "09:00", end: "13:00" },
      { day: "sunday", start: "17:00", end: "21:00" },
      { day: "tuesday", start: "10:00", end: "24:00" },
    ]);
    expect(values.appointment_minutes).toBe("20");
  });

  it("starts empty when there's no schedule", () => {
    expect(
      scheduleToFormValues({ ...base, appointment_minutes: null }),
    ).toEqual({ appointment_minutes: "", periods: [] });
  });
});

describe("insertionIndex", () => {
  const rows = [
    { day: "sunday" as const },
    { day: "sunday" as const },
    { day: "tuesday" as const },
  ];

  it.each([
    ["sunday", 2],
    ["monday", 2],
    ["tuesday", 3],
    ["saturday", 3],
  ] as const)(
    "puts a new %s row at %i, so that the list stays in screen order",
    (day, expected) => {
      expect(insertionIndex(rows, day)).toBe(expected);
    },
  );

  it("starts an empty list at 0", () => {
    expect(insertionIndex([], "friday")).toBe(0);
  });
});
