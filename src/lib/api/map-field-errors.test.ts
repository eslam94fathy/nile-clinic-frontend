import { describe, expect, it, vi } from "vitest";
import { mapFieldErrors } from "./map-field-errors";

type Values = { email: string; "items.0.dose": string };
const fields = ["email", "items.0.dose"] as const;
const FALLBACK = "Something went wrong.";

describe("mapFieldErrors", () => {
  it("puts errors on their fields, including nested keys", () => {
    const setError = vi.fn();

    const rest = mapFieldErrors<Values>(
      {
        status: 422,
        message: "Check the form.",
        fieldErrors: { email: ["One.", "Two."], "items.0.dose": ["Needed."] },
      },
      fields,
      setError,
      FALLBACK,
    );

    expect(setError).toHaveBeenCalledWith("email", {
      type: "server",
      message: "One. Two.",
    });
    expect(setError).toHaveBeenCalledWith("items.0.dose", {
      type: "server",
      message: "Needed.",
    });
    expect(rest).toEqual([]);
  });

  it("returns errors with no matching field", () => {
    const setError = vi.fn();

    const rest = mapFieldErrors<Values>(
      { status: 422, fieldErrors: { charge: ["Already paid."] } },
      fields,
      setError,
      FALLBACK,
    );

    expect(setError).not.toHaveBeenCalled();
    expect(rest).toEqual(["Already paid."]);
  });

  it("returns the message when there are no field errors", () => {
    const rest = mapFieldErrors<Values>(
      { status: 500, message: "Failed.", fieldErrors: {} },
      fields,
      vi.fn(),
      FALLBACK,
    );

    expect(rest).toEqual(["Failed."]);
  });

  it("returns the fallback when the API sent no text", () => {
    expect(
      mapFieldErrors<Values>(
        { status: 0, fieldErrors: {} },
        fields,
        vi.fn(),
        FALLBACK,
      ),
    ).toEqual([FALLBACK]);
  });
});
