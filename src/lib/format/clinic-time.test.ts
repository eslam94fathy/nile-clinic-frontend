import { describe, expect, it } from "vitest";
import { readClinicTime } from "./clinic-time";

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
