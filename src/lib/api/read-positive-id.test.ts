import { describe, expect, it } from "vitest";
import { readPositiveId } from "./read-positive-id";

describe("readPositiveId", () => {
  it.each([
    ["1", 1],
    ["42", 42],
  ])("reads %s", (value, expected) => {
    expect(readPositiveId(value)).toBe(expected);
  });

  it.each([
    "0",
    "-1",
    "1.5",
    "abc",
    "",
    "1e3",
    "01",
    " 1",
    "99999999999999999",
  ])("refuses %j", (value) => {
    expect(readPositiveId(value)).toBeNull();
  });
});
