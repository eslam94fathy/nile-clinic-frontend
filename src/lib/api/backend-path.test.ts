import { describe, expect, it } from "vitest";
import { checkBackendPath } from "./backend-path";

describe("checkBackendPath", () => {
  it.each(["staff", "auth/me", "auth/password", "doctors/5/slots", "a%20b"])(
    "allows %s, unchanged",
    (path) => {
      expect(checkBackendPath(path)).toBe(path);
    },
  );

  it.each([
    "auth/sign-in",
    "AUTH/SIGN-IN",
    "auth/Sign-In",
    "auth/sign%2Din",
    "%61uth/sign-in",
    "auth/sign-out",
    "AUTH/sign-OUT",
  ])("refuses the sign-in and sign-out path %s", (path) => {
    expect(checkBackendPath(path)).toBeNull();
  });

  it.each([
    "",
    "..",
    "../secret",
    "staff/../auth/sign-in",
    "staff/%2e%2e/secret",
    "staff/%2E%2E/secret",
    ".",
    "staff/./x",
    "staff//x",
    "staff/",
    "staff%2Fx",
    "staff%2fx",
    "staff%5Cx",
    "staff\\x",
    "staff%00",
    "staff%0d%0ax",
    "%E0%A4%A",
  ])("refuses the unsafe path %j", (path) => {
    expect(checkBackendPath(path)).toBeNull();
  });
});
