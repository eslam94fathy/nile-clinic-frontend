import { describe, expect, it } from "vitest";
import { toApiError } from "./api-error";

describe("toApiError", () => {
  it("keeps the message, field errors, and reason as sent", () => {
    expect(
      toApiError(409, {
        message: "Taken.",
        errors: { start: ["Taken."], "prescriptions.0.dosage": ["Needed."] },
        reason: "slot_booked",
      }),
    ).toEqual({
      status: 409,
      message: "Taken.",
      fieldErrors: {
        start: ["Taken."],
        "prescriptions.0.dosage": ["Needed."],
      },
      reason: "slot_booked",
    });
  });

  it.each([null, undefined, "<html>", 5, []])(
    "gives no message for the body %j",
    (body) => {
      expect(toApiError(500, body)).toEqual({ status: 500, fieldErrors: {} });
    },
  );

  it("ignores parts of the wrong shape", () => {
    expect(
      toApiError(422, {
        message: 7,
        errors: { a: "not a list", b: [1, "kept"], c: [2] },
        reason: null,
      }),
    ).toEqual({ status: 422, fieldErrors: { b: ["kept"] } });
  });
});
