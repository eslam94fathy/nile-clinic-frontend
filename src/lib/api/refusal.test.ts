import { describe, expect, it } from "vitest";
import { allMessages, isOutcomeUnknown } from "./refusal";

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
