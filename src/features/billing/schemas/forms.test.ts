import { describe, expect, it } from "vitest";
import {
  cancelFormSchema,
  discountFormSchema,
  paymentFormSchema,
  refundFormSchema,
} from "./forms";

const text = {
  amountRule: "Bad amount.",
  aboveBalance: "Above the balance.",
  abovePaid: "Above what was paid.",
  methodRule: "Choose a method.",
  reasonRule: "Give a reason.",
};
const errorsOf = (result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) =>
  Object.fromEntries(
    (result.error?.issues ?? []).map(({ path, message }) => [
      String(path[0]),
      message,
    ]),
  );

describe("the payment form", () => {
  const schema = paymentFormSchema(text, "150.50");

  it("keeps the amount as text, with Western digits", () => {
    expect(schema.parse({ amount: "١٥٠٫٥", method: "cash" })).toEqual({
      amount: "150.5",
      method: "cash",
    });
  });

  it("accepts the whole balance", () => {
    expect(schema.safeParse({ amount: "150.50", method: "card" }).success).toBe(
      true,
    );
  });

  it("refuses more than the balance, on the amount", () => {
    expect(
      errorsOf(schema.safeParse({ amount: "150.51", method: "card" })),
    ).toEqual({ amount: "Above the balance." });
  });

  it.each(["0", "0.001", "-1", "abc", ""])("refuses the amount %j", (value) => {
    expect(
      errorsOf(schema.safeParse({ amount: value, method: "wallet" })),
    ).toEqual({ amount: "Bad amount." });
  });

  it("needs a method to be chosen", () => {
    expect(errorsOf(schema.safeParse({ amount: "10", method: "" }))).toEqual({
      method: "Choose a method.",
    });
  });
});

describe("the refund form", () => {
  const schema = refundFormSchema(text, "100.00");

  it("accepts up to what was paid, with a reason", () => {
    expect(
      schema.safeParse({
        amount: "100",
        method: "cash",
        reason: "Synthetic overpayment",
      }).success,
    ).toBe(true);
  });

  it("refuses more than was paid, and a missing reason", () => {
    expect(
      errorsOf(
        schema.safeParse({ amount: "100.01", method: "cash", reason: " " }),
      ),
    ).toEqual({ reason: "Give a reason.", amount: "Above what was paid." });
  });

  it("refuses a reason over 500 characters", () => {
    expect(
      errorsOf(
        schema.safeParse({
          amount: "1",
          method: "cash",
          reason: "x".repeat(501),
        }),
      ),
    ).toEqual({ reason: "Give a reason." });
  });
});

describe("the discount form", () => {
  const schema = discountFormSchema(text);

  it("accepts zero, which removes a discount", () => {
    expect(schema.parse({ amount: "0", reason: "Synthetic removal" })).toEqual({
      amount: "0",
      reason: "Synthetic removal",
    });
  });

  it("refuses an amount with three decimals", () => {
    expect(
      errorsOf(schema.safeParse({ amount: "1.005", reason: "Synthetic" })),
    ).toEqual({ amount: "Bad amount." });
  });
});

describe("the cancel form", () => {
  it("needs a reason of at most 500 characters", () => {
    const schema = cancelFormSchema(text);
    expect(schema.safeParse({ reason: "x".repeat(500) }).success).toBe(true);
    expect(schema.safeParse({ reason: "" }).success).toBe(false);
  });
});
