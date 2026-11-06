import { describe, expect, it } from "vitest";
import { parseEnv } from "./env-schema";

const valid = { BACKEND_API_URL: "http://localhost:8081/api/v1" };

describe("parseEnv", () => {
  it("accepts a valid configuration and applies the default time zone", () => {
    expect(parseEnv(valid)).toEqual({
      ok: true,
      env: {
        BACKEND_API_URL: "http://localhost:8081/api/v1",
        CLINIC_TIMEZONE: "Africa/Cairo",
      },
    });
  });

  it.each([
    ["one", "http://localhost:8081/api/v1/"],
    ["several", "https://api.example.test/api/v1///"],
  ])("removes %s trailing slash", (_label, url) => {
    const result = parseEnv({ BACKEND_API_URL: url });
    expect(result.ok && result.env.BACKEND_API_URL.endsWith("/")).toBe(false);
  });

  it("accepts a valid IANA time zone", () => {
    const result = parseEnv({ ...valid, CLINIC_TIMEZONE: "Asia/Dubai" });
    expect(result.ok && result.env.CLINIC_TIMEZONE).toBe("Asia/Dubai");
  });

  it.each([
    ["missing", {}],
    ["empty", { BACKEND_API_URL: "" }],
    ["relative", { BACKEND_API_URL: "/api/v1" }],
    ["another protocol", { BACKEND_API_URL: "ftp://localhost/api/v1" }],
    ["not a URL", { BACKEND_API_URL: "secret-looking-value" }],
    ["with a query", { BACKEND_API_URL: "http://host/api/v1?x=1" }],
    ["with a fragment", { BACKEND_API_URL: "http://host/api/v1#a" }],
    ["with credentials", { BACKEND_API_URL: "http://user:pw@host/api/v1" }],
    ["with surrounding spaces", { BACKEND_API_URL: " http://host/api/v1 " }],
  ])("rejects a backend address that is %s", (_label, source) => {
    const result = parseEnv(source);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.problems.join()).toContain("BACKEND_API_URL");
  });

  it("rejects an invalid time zone and names the setting", () => {
    const result = parseEnv({ ...valid, CLINIC_TIMEZONE: "Mars/Base" });
    expect(!result.ok && result.problems.join()).toContain("CLINIC_TIMEZONE");
  });

  it.each([
    ["unset", {}, undefined],
    ["true", { DESIGN_PREVIEW_ENABLED: "true" }, "true"],
    ["false", { DESIGN_PREVIEW_ENABLED: "false" }, "false"],
  ])("accepts a preview setting that is %s", (_label, source, expected) => {
    const result = parseEnv({ ...valid, ...source });
    expect(result.ok && result.env.DESIGN_PREVIEW_ENABLED).toBe(expected);
  });

  it("rejects any other preview setting, naming it without its value", () => {
    const result = parseEnv({ ...valid, DESIGN_PREVIEW_ENABLED: "secret-yes" });
    expect(result.ok).toBe(false);
    const problems = !result.ok ? result.problems.join() : "";
    expect(problems).toContain("DESIGN_PREVIEW_ENABLED");
    expect(problems).not.toContain("secret");
  });

  it("never includes a setting's value in its messages", () => {
    const result = parseEnv({
      BACKEND_API_URL: "secret-looking-value",
      CLINIC_TIMEZONE: "secret-looking-zone",
    });
    expect(!result.ok && result.problems.join()).not.toContain("secret");
  });
});
