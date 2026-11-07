import { describe, expect, it } from "vitest";
import { safeReturnAddress } from "./return-address";

describe("safeReturnAddress", () => {
  it.each([
    ["/queue", "/queue"],
    ["/en/queue", "/queue"],
    ["/ar/charges/5", "/charges/5"],
    ["/my/queue", "/my/queue"],
    ["/patients", "/patients"],
    ["/my/visits", "/my/visits"],
  ])("accepts %s as %s", (raw, expected) => {
    expect(safeReturnAddress(raw)).toBe(expected);
  });

  it.each([
    ["/queue?name=Synthetic", "/queue"],
    ["/queue#top", "/queue"],
    ["/queue?a=1#b", "/queue"],
    ["/patients?search=Synthetic", "/patients"],
    ["/en/queue/walk-in?patient_id=12", "/queue/walk-in"],
    ["/en/queue?doctor_id=3&status=waiting", "/queue"],
  ])("drops the query and fragment of %s", (raw, expected) => {
    expect(safeReturnAddress(raw)).toBe(expected);
  });

  it.each([
    "",
    null,
    undefined,
    "queue",
    "https://evil.test",
    "//evil.test",
    "///evil.test",
    "/\\evil.test",
    "\\\\evil.test",
    "javascript:alert(1)",
    " /queue",
    "/queue\n",
    "/queue%0d%0aSet-Cookie:a",
    "/%2F%2Fevil.test",
    "/%2f%2fevil.test",
    "/%5Cevil.test",
    "/queue/../../evil",
    "/queue/%2e%2e/evil",
    "/queue/./x",
    "/queue//x",
    "/queue/",
    "/%E0%A4%A",
    "/",
    "/en",
    "/ar/",
  ])("refuses %j", (raw) => {
    expect(safeReturnAddress(raw)).toBeNull();
  });

  it.each(["/sign-in", "/en/sign-in", "/api/backend/x", "/_next/x"])(
    "refuses %s, which isn't a page to return to",
    (raw) => {
      expect(safeReturnAddress(raw)).toBeNull();
    },
  );

  it.each([
    "/patients/5",
    "/en/patients/5",
    "/patients/new",
    "/patients/5/edit",
    "/%70atients/5",
    "/Patients/5",
    "/my/encounters/5",
    "/my/%65ncounters/5",
    "/my/patients/5/history",
    "/audit",
    "/ar/audit",
    "/audit?from=2026-01-01",
  ])("refuses the audited page %s", (raw) => {
    expect(safeReturnAddress(raw)).toBeNull();
  });

  it("returns to an appointment page, with no patient number", () => {
    expect(safeReturnAddress("/en/appointments?patient_id=12")).toBe(
      "/appointments",
    );
    expect(safeReturnAddress("/en/appointments/new?patient_id=12")).toBe(
      "/appointments/new",
    );
    expect(safeReturnAddress("/en/appointments/5")).toBe("/appointments/5");
  });
});
