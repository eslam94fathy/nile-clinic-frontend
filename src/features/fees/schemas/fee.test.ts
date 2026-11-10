import { describe, expect, it } from "vitest";
import { feeFormSchema } from "./fee";

describe("feeFormSchema", () => {
  const schema = feeFormSchema({ amountRule: "Bad amount." });

  it("converts Arabic digits, and keeps the amount a string", () => {
    expect(schema.parse({ amount: "٣٥٠.١٠" })).toEqual({ amount: "350.10" });
  });

  it("accepts the Arabic decimal separator", () => {
    expect(schema.parse({ amount: "١٥٠٫٥٠" })).toEqual({ amount: "150.50" });
  });

  it("keeps the digits exactly as typed", () => {
    expect(schema.parse({ amount: "0.07" }).amount).toBe("0.07");
    expect(schema.parse({ amount: "99999.99" }).amount).toBe("99999.99");
  });

  it("trims spaces", () => {
    expect(schema.parse({ amount: " 350 " }).amount).toBe("350");
  });

  it("gives the rule's message", () => {
    const result = schema.safeParse({ amount: "0" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Bad amount.");
  });
});
