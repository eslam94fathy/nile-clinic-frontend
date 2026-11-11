import { describe, expect, it } from "vitest";
import { minutesToClockTime, readClinicTime } from "./clinic-time";

describe("readClinicTime", () => {
  it.each(["09:20", "00:00", "23:55", "24:00", "09:21"])(
    "returns %s unchanged",
    (value) => {
      expect(readClinicTime(value)).toBe(value);
    },
  );

  it.each([
    "25:00",
    "24:01",
    "24:05",
    "9:20",
    "09:60",
    "09:20:00",
    "",
    null,
    undefined,
  ])("gives nothing for %s", (value) => {
    expect(readClinicTime(value)).toBeNull();
  });
});

describe("minutesToClockTime", () => {
  it.each([
    [0, "00:00"],
    [5, "00:05"],
    [540, "09:00"],
    [1015, "16:55"],
    [1440, "24:00"],
  ])("gives %s as %s", (minutes, time) => {
    expect(minutesToClockTime(minutes)).toBe(time);
  });

  it.each([-1, 1441, 9.5, Number.NaN, "540", null, undefined, true])(
    "gives nothing for %s",
    (value) => {
      expect(minutesToClockTime(value)).toBeNull();
    },
  );
});
