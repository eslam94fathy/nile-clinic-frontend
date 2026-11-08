import { describe, expect, it } from "vitest";
import {
  compareAmounts,
  isAmount,
  normalizeAmount,
  toMoneyText,
} from "./amount";

describe("normalizeAmount", () => {
  it("gives Western digits and a dot, and trims", () => {
    expect(normalizeAmount(" ٣٥٠٫١٠ ")).toBe("350.10");
    expect(normalizeAmount("۱۲")).toBe("12");
    expect(normalizeAmount("150.5")).toBe("150.5");
  });
});

describe("isAmount", () => {
  it.each([
    "0.01",
    "1",
    "350",
    "350.1",
    "350.10",
    "99999.99",
    "100000",
    "100000.0",
    "100000.00",
    "007",
    "000000100000",
  ])("accepts %s", (amount) => {
    expect(isAmount(amount)).toBe(true);
  });

  it.each([
    "0",
    "0.0",
    "0.00",
    "000",
    "0.001",
    "100000.01",
    "100001",
    "1234567",
    "350.123",
    "-1",
    "-5",
    ".5",
    "5.",
    "1e3",
    "1,000",
    "abc",
    "",
    " 5",
  ])("refuses %j", (amount) => {
    expect(isAmount(amount)).toBe(false);
  });

  it.each(["0", "0.0", "0.00", "000"])(
    "accepts %s only when zero is allowed",
    (amount) => {
      expect(isAmount(amount, { allowZero: true })).toBe(true);
      expect(isAmount(amount)).toBe(false);
    },
  );

  it("still refuses what isn't an amount when zero is allowed", () => {
    expect(isAmount("-1", { allowZero: true })).toBe(false);
    expect(isAmount("100000.01", { allowZero: true })).toBe(false);
    expect(isAmount("", { allowZero: true })).toBe(false);
  });
});

describe("compareAmounts", () => {
  it.each([
    ["9.99", "10.00", -1],
    ["10.00", "9.99", 1],
    ["150", "150.00", 0],
    ["150.5", "150.50", 0],
    ["0.01", "0.10", -1],
    ["007", "7.00", 0],
    ["99999.99", "100000.00", -1],
    ["100000", "99999.99", 1],
    ["0", "0.00", 0],
  ] as const)("compares %s with %s as %i", (a, b, expected) => {
    expect(compareAmounts(a, b)).toBe(expected);
  });

  it("orders 100 payments of 0.01 against a balance of 1.00 without drift", () => {
    // Each step is the API's next balance, given here as text, as it would arrive.
    const balances = Array.from(
      { length: 101 },
      (_, paid) => `0.${String(100 - paid).padStart(2, "0")}`,
    ).map((text, index) => (index === 0 ? "1.00" : text));

    for (let paid = 0; paid < 100; paid += 1) {
      expect(compareAmounts("0.01", balances[paid] ?? "")).not.toBe(1);
    }
    expect(balances[100]).toBe("0.00");
    expect(compareAmounts("0.01", balances[100] ?? "")).toBe(1);
  });

  it("throws on something that isn't an amount, rather than guessing", () => {
    expect(() => compareAmounts("abc", "1.00")).toThrow();
    expect(() => compareAmounts("1.001", "1.00")).toThrow();
  });
});

describe("toMoneyText", () => {
  it.each([
    ["150", "150.00"],
    ["150.5", "150.50"],
    ["150.05", "150.05"],
    ["007", "7.00"],
    ["0.1", "0.10"],
    ["0", "0.00"],
    ["100000", "100000.00"],
  ])("writes %s as the API's money, %s", (amount, money) => {
    expect(toMoneyText(amount)).toBe(money);
  });

  it("throws on something that isn't an amount", () => {
    expect(() => toMoneyText("1.234")).toThrow();
  });
});
