import { describe, expect, it } from "vitest";
import { isAboutTheTime } from "./refusal";

const error = (status: number, fieldErrors: Record<string, string[]> = {}) => ({
  status,
  fieldErrors,
});

describe("isAboutTheTime", () => {
  it("is true for a conflict", () => {
    expect(isAboutTheTime(error(409))).toBe(true);
  });

  it("is true for a refusal under the start or the date", () => {
    expect(isAboutTheTime(error(422, { start: ["No."] }))).toBe(true);
    expect(isAboutTheTime(error(422, { date: ["No."] }))).toBe(true);
  });

  it("is false for anything else", () => {
    expect(isAboutTheTime(error(422, { note: ["No."] }))).toBe(false);
    expect(isAboutTheTime(error(422, { appointment: ["No."] }))).toBe(false);
    expect(isAboutTheTime(error(500))).toBe(false);
  });
});
