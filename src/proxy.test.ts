// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import proxy from "./proxy";

function request(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(new URL(path, "http://clinic.test"), { headers });
}

function redirectOf(path: string, headers?: Record<string, string>) {
  const response = proxy(request(path, headers));
  return { status: response.status, to: response.headers.get("location") };
}

describe("addresses without a supported language", () => {
  it("sends a bare address to Arabic by default", () => {
    expect(redirectOf("/")).toEqual({
      status: 307,
      to: "http://clinic.test/ar",
    });
  });

  it("ignores the browser's language", () => {
    expect(redirectOf("/", { "accept-language": "en-US,en" }).to).toBe(
      "http://clinic.test/ar",
    );
  });

  it("follows the saved choice over the browser's language", () => {
    const headers = { cookie: "NEXT_LOCALE=en", "accept-language": "ar" };
    expect(redirectOf("/", headers).to).toBe("http://clinic.test/en");
  });

  it("ignores an unsupported saved choice", () => {
    expect(redirectOf("/", { cookie: "NEXT_LOCALE=fr" }).to).toBe(
      "http://clinic.test/ar",
    );
  });

  it("keeps the path under the visitor's language", () => {
    expect(redirectOf("/fr/page").to).toBe("http://clinic.test/ar/fr/page");
  });

  it("does not treat a different letter case as a supported language", () => {
    expect(redirectOf("/AR").to).toBe("http://clinic.test/ar/AR");
  });

  it("preserves the query string", () => {
    expect(redirectOf("/?a=1&b=2").to).toBe("http://clinic.test/ar?a=1&b=2");
  });

  it("stays on the same origin for a path that looks like another host", () => {
    const response = proxy(new NextRequest("http://clinic.test//evil.test/x"));
    expect(response.headers.get("location")).toMatch(
      /^http:\/\/clinic\.test\/ar\//,
    );
  });
});

describe("addresses with a supported language", () => {
  it.each(["/ar", "/en", "/en/anything"])("does not redirect %s", (path) => {
    const response = proxy(request(path));
    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
  });
});
