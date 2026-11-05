import { describe, expect, it } from "vitest";
import { compareMessages } from "./check-i18n.mjs";

describe("compareMessages", () => {
  it("passes identical nested keys", () => {
    const a = { x: "1", y: { z: "2" } };
    const b = { x: "one", y: { z: "two" } };
    expect(compareMessages({ ar: a, en: b })).toEqual([]);
  });

  it("names a key missing from one language", () => {
    const problems = compareMessages({
      ar: { y: { z: "2" } },
      en: { y: { z: "two", w: "three" } },
    });
    expect(problems).toEqual(['"y.w" is missing from ar']);
  });

  it("names a key whose shape differs", () => {
    const problems = compareMessages({ ar: { y: "2" }, en: { y: { z: "t" } } });
    expect(problems).toContain('"y" is missing from en');
    expect(problems).toContain('"y.z" is missing from ar');
  });

  it("names an empty translation", () => {
    expect(compareMessages({ ar: { x: " " }, en: { x: "one" } })).toEqual([
      '"x" is empty in ar',
    ]);
  });
});
