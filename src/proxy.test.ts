// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
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

describe("the design preview address", () => {
  const rewriteOf = (path: string) =>
    proxy(request(path)).headers.get("x-middleware-rewrite");

  it.each(["/ar/design-preview", "/en/design-preview", "/ar/design-preview/x"])(
    "sends %s to an unknown address when the setting is unset",
    (path) => {
      const target = rewriteOf(path);
      expect(target).toBe(`http://clinic.test/${path.slice(1, 3)}/__unknown`);
    },
  );

  it.each([
    "/ar/design%2Dpreview",
    "/ar/%64esign-preview",
    "/ar/design%2dpreview",
  ])("also catches the encoded %s", (path) => {
    expect(rewriteOf(path)).toBe("http://clinic.test/ar/__unknown");
  });

  it("doesn't fail on a malformed address", () => {
    expect(rewriteOf("/ar/%E0%A4%A")).toBeNull();
  });

  it("does the same when the setting is false", () => {
    vi.stubEnv("DESIGN_PREVIEW_ENABLED", "false");
    expect(rewriteOf("/ar/design-preview")).toBe(
      "http://clinic.test/ar/__unknown",
    );
  });

  it("drops the query", () => {
    expect(rewriteOf("/ar/design-preview?a=1")).toBe(
      "http://clinic.test/ar/__unknown",
    );
  });

  it("passes through when the setting is true", () => {
    vi.stubEnv("DESIGN_PREVIEW_ENABLED", "true");
    expect(rewriteOf("/ar/design-preview")).toBeNull();
  });

  it("doesn't catch a similar address", () => {
    expect(rewriteOf("/ar/design-previewx")).toBeNull();
  });
});
