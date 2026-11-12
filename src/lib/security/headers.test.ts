import { describe, expect, it } from "vitest";
import { securityHeaders } from "./headers";

function asMap(isDev: boolean) {
  return new Map(securityHeaders(isDev).map(({ key, value }) => [key, value]));
}

const POLICY = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "object-src 'none'",
].join("; ");

describe("securityHeaders", () => {
  it("sends exactly the headers in the contract, in production", () => {
    expect(Object.fromEntries(asMap(false))).toEqual({
      "Content-Security-Policy": POLICY,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "X-Frame-Options": "DENY",
      "Permissions-Policy":
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), hid=(), display-capture=(), browsing-topics=()",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Resource-Policy": "same-origin",
    });
  });

  it("allows eval only in development, where React needs it", () => {
    expect(asMap(false).get("Content-Security-Policy")).not.toContain(
      "unsafe-eval",
    );
    expect(asMap(true).get("Content-Security-Policy")).toContain(
      "script-src 'self' 'unsafe-inline' 'unsafe-eval';",
    );
  });

  it("leaves transport security and upgrading to the reverse proxy", () => {
    for (const isDev of [false, true]) {
      const headers = asMap(isDev);
      expect(headers.has("Strict-Transport-Security")).toBe(false);
      expect(headers.get("Content-Security-Policy")).not.toContain(
        "upgrade-insecure-requests",
      );
    }
  });

  it("names each header once", () => {
    const keys = securityHeaders(false).map(({ key }) => key.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
  });
});
