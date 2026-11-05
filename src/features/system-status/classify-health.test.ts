import { describe, expect, it } from "vitest";
import { classifyHealth } from "./classify-health";

const ok = { status: "ok", checks: { database: "ok" } };
const down = { status: "unavailable", checks: { database: "unavailable" } };

describe("classifyHealth", () => {
  it("is working only for the documented healthy response", () => {
    expect(classifyHealth(200, ok)).toBe("working");
  });

  it("is unavailable for the documented unavailable response", () => {
    expect(classifyHealth(503, down)).toBe("unavailable");
  });

  it("is not working when a 200 response reports a problem", () => {
    expect(classifyHealth(200, down)).toBe("unavailable");
    expect(
      classifyHealth(200, {
        status: "ok",
        checks: { database: "unavailable" },
      }),
    ).toBe("unavailable");
    expect(
      classifyHealth(200, {
        status: "unavailable",
        checks: { database: "ok" },
      }),
    ).toBe("unavailable");
  });

  it.each([
    ["no body", 200, null],
    ["a non-object", 200, "ok"],
    ["a missing field", 200, { status: "ok" }],
    ["an unknown value", 200, { status: "fine", checks: { database: "ok" } }],
    ["an extra field", 200, { ...ok, extra: true }],
    ["an extra check", 200, { status: "ok", checks: { database: "ok", a: 1 } }],
    ["a healthy body on a failure status", 500, ok],
    ["a healthy body on a redirect", 302, ok],
    ["a failure with no documented body", 503, null],
    ["a framework error page", 404, { message: "Not found" }],
    ["a down-shaped body on a server error", 500, down],
    ["a down-shaped body on not found", 404, down],
    ["a down-shaped body on a redirect", 302, down],
    ["a healthy body with status 503", 503, ok],
  ])("is unreachable for %s", (_label, status, body) => {
    expect(classifyHealth(status, body)).toBe("unreachable");
  });
});
