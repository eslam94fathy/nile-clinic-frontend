import { describe, expect, it } from "vitest";
import { REPORTS_ROOT_KEY, reportKey } from "./query-keys";

describe("reportKey", () => {
  const choices = {
    from: "2026-11-01",
    to: "2026-11-08",
    doctorId: null,
    page: 1,
  };

  it("starts with the root key", () => {
    expect(reportKey("billing", choices).slice(0, 1)).toEqual([
      ...REPORTS_ROOT_KEY,
    ]);
  });

  it("differs by report and by each choice", () => {
    const keys = [
      reportKey("billing", choices),
      reportKey("times", choices),
      reportKey("billing", { ...choices, doctorId: 3 }),
      reportKey("billing", { ...choices, page: 2 }),
      reportKey("billing", { ...choices, to: "2026-11-07" }),
    ].map((key) => JSON.stringify(key));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
