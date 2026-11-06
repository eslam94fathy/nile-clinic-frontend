import { describe, expect, it } from "vitest";
import { toWesternDigits } from "./digits";

describe("toWesternDigits", () => {
  it("converts Arabic-Indic digits", () => {
    expect(toWesternDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
  });

  it("converts inside a value, and leaves everything else alone", () => {
    expect(toWesternDigits("٠٩:٣٠")).toBe("09:30");
    expect(toWesternDigits("٣٥٠.١٠")).toBe("350.10");
    expect(toWesternDigits("24:00")).toBe("24:00");
    expect(toWesternDigits("abc ١")).toBe("abc 1");
  });
});
