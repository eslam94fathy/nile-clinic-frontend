import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatMoney } from "./money";

describe("formatMoney", () => {
  it.each([
    ["150.00", "150.00"],
    ["-1250.50", "1,250.50"],
    ["12345678901234567.89", "12,345,678,901,234,567.89"],
    ["0.00", "0.00"],
  ])("keeps every digit of %s in both languages", (value, digits) => {
    expect(formatMoney(value, "en")).toContain(digits);
    expect(formatMoney(value, "ar")).toContain(digits);
  });

  it("keeps a negative sign", () => {
    expect(formatMoney("-1250.50", "en")).toContain("-");
    expect(formatMoney("-1250.50", "ar")).toContain("-");
  });

  it("identifies the currency in the active language", () => {
    expect(formatMoney("150.00", "en")).toContain("EGP");
    expect(formatMoney("150.00", "ar")).toContain("ج.م");
  });

  it("uses Western digits in Arabic", () => {
    expect(formatMoney("150.00", "ar")).not.toMatch(/[٠-٩]/);
  });

  it.each([
    "150",
    "1.5",
    "1.555",
    "abc",
    "",
    " 1.00",
    "1e3.00",
    null,
    undefined,
  ])("gives nothing for %s", (value) => {
    expect(formatMoney(value, "en")).toBeNull();
  });

  it("never converts to a number", () => {
    const source = readFileSync("src/lib/format/money.ts", "utf8");
    expect(source).not.toMatch(/\bNumber\(|parseFloat|parseInt|Math\./);
  });
});
