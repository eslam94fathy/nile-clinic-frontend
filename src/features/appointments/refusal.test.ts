import { describe, expect, it } from "vitest";
import { allMessages, isAboutTheTime, isOutcomeUnknown } from "./refusal";

const error = (
  status: number,
  fieldErrors: Record<string, string[]> = {},
  message?: string,
) => ({
  status,
  fieldErrors,
  ...(message ? { message } : {}),
});

describe("isOutcomeUnknown", () => {
  it.each([0, 502, 503, 504])("is true for %i", (status) => {
    expect(isOutcomeUnknown(error(status))).toBe(true);
  });

  it.each([400, 403, 404, 409, 422, 500])("is false for %i", (status) => {
    expect(isOutcomeUnknown(error(status))).toBe(false);
  });
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

describe("allMessages", () => {
  it("gathers every message, and drops none", () => {
    expect(
      allMessages(
        error(422, { appointment: ["One."], other: ["Two.", "Three."] }),
        "Fallback",
      ),
    ).toEqual(["One.", "Two.", "Three."]);
  });

  it("uses the message, then the fallback", () => {
    expect(allMessages(error(500, {}, "Sent."), "Fallback")).toEqual(["Sent."]);
    expect(allMessages(error(500), "Fallback")).toEqual(["Fallback"]);
  });
});
