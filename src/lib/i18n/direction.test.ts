import { expect, it } from "vitest";
import { getDirection } from "./direction";

it("is right to left for Arabic", () => {
  expect(getDirection("ar")).toBe("rtl");
});

it("is left to right for English", () => {
  expect(getDirection("en")).toBe("ltr");
});
