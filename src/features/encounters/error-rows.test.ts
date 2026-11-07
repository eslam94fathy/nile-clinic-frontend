import { describe, expect, it } from "vitest";
import { withScreenLines } from "./error-rows";

const failure = (fieldErrors: Record<string, string[]>) => ({
  status: 422,
  fieldErrors,
});

describe("withScreenLines", () => {
  it("moves a line's error to the line on screen", () => {
    const { fieldErrors } = withScreenLines(
      failure({ "prescriptions.1.dosage": ["Needed"] }),
      [0, 3],
    );
    expect(fieldErrors).toEqual({ "prescriptions.3.dosage": ["Needed"] });
  });

  it("leaves other keys alone", () => {
    const { fieldErrors } = withScreenLines(
      failure({ diagnosis: ["Needed"], encounter: ["Locked"] }),
      [],
    );
    expect(fieldErrors).toEqual({
      diagnosis: ["Needed"],
      encounter: ["Locked"],
    });
  });

  it("keeps a line it can't match, so that nothing is dropped", () => {
    const { fieldErrors } = withScreenLines(
      failure({ "prescriptions.9.dosage": ["Needed"] }),
      [0],
    );
    expect(fieldErrors).toEqual({ "prescriptions.9.dosage": ["Needed"] });
  });

  it("keeps the rest of the failure", () => {
    const answer = withScreenLines(
      { status: 422, message: "Refused", fieldErrors: {} },
      [],
    );
    expect(answer).toEqual({
      status: 422,
      message: "Refused",
      fieldErrors: {},
    });
  });
});
