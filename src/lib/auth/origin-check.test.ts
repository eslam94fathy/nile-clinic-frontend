import { describe, expect, it } from "vitest";
import { isSameOrigin, isStateChanging } from "./origin-check";

describe("isSameOrigin", () => {
  it("accepts an origin whose host equals the request's", () => {
    expect(
      isSameOrigin(
        new Headers({ origin: "https://clinic.test", host: "clinic.test" }),
      ),
    ).toBe(true);
  });

  it.each([
    [{ origin: "https://evil.test", host: "clinic.test" }],
    [{ origin: "https://clinic.test.evil.test", host: "clinic.test" }],
    [{ origin: "https://clinic.test:8443", host: "clinic.test" }],
    [{ origin: "null", host: "clinic.test" }],
    [{ origin: "not a url", host: "clinic.test" }],
    [{ host: "clinic.test" }],
    [{ origin: "https://clinic.test" }],
    [{}],
  ])("refuses %j", (headers) => {
    expect(isSameOrigin(new Headers(headers))).toBe(false);
  });
});

describe("isStateChanging", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE"])("%s is", (method) => {
    expect(isStateChanging(method)).toBe(true);
  });

  it.each(["GET", "HEAD"])("%s is not", (method) => {
    expect(isStateChanging(method)).toBe(false);
  });
});
