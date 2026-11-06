import { describe, expect, it } from "vitest";
import {
  checkThemes,
  contrastRatio,
  findRawColors,
  parseThemes,
  REQUIRED_PAIRS,
} from "./check-contrast.mjs";

const tokensPassing = {
  ...Object.fromEntries(
    REQUIRED_PAIRS.flatMap(([front, back]) => [
      [front, "#000000"],
      [back, "#FFFFFF"],
    ]),
  ),
  // These two are text on some backgrounds, and a background for their own foreground.
  primary: "#000000",
  "primary-foreground": "#FFFFFF",
  destructive: "#000000",
  "destructive-foreground": "#FFFFFF",
};

const css = (tokens) =>
  Object.entries(tokens)
    .map(([name, value]) => `  --${name}: ${value};`)
    .join("\n");

describe("contrastRatio", () => {
  it("matches WCAG's known values", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 1);
  });

  it("doesn't depend on the order", () => {
    expect(contrastRatio("#123456", "#FEDCBA")).toBe(
      contrastRatio("#FEDCBA", "#123456"),
    );
  });
});

describe("parseThemes", () => {
  it("reads both themes", () => {
    const themes = parseThemes(
      `:root {\n--a: #111111;\n}\n[data-theme="dark"] {\n--a: #EEEEEE;\n}`,
    );
    expect(themes.light.a).toBe("#111111");
    expect(themes.dark.a).toBe("#EEEEEE");
  });
});

describe("checkThemes", () => {
  it("passes when every pair meets its target", () => {
    expect(checkThemes({ light: tokensPassing, dark: tokensPassing })).toEqual(
      [],
    );
  });

  it("reports a failing pair, with its theme", () => {
    const [front, back] = REQUIRED_PAIRS[0];
    const tokens = { ...tokensPassing, [front]: "#FFFFFF", [back]: "#FFFFFF" };
    const problems = checkThemes({ light: tokens, dark: tokensPassing });

    expect(problems.join()).toContain("light");
    expect(problems.join()).toContain(front);
  });

  it("reports a missing token", () => {
    const [front] = REQUIRED_PAIRS[0];
    const tokens = { ...tokensPassing };
    delete tokens[front];

    expect(
      checkThemes({ light: tokens, dark: tokensPassing }).join(),
    ).toContain("missing");
  });

  it("reports a token in a pair that isn't solid hex", () => {
    const [front] = REQUIRED_PAIRS[0];
    const tokens = { ...tokensPassing, [front]: "oklch(0.5 0 0)" };

    expect(
      checkThemes({ light: tokens, dark: tokensPassing }).join(),
    ).toContain("solid hex");
  });

  it("reports a translucent token in a pair", () => {
    const [front] = REQUIRED_PAIRS[0];
    const tokens = { ...tokensPassing, [front]: "#00000066" };

    expect(
      checkThemes({ light: tokens, dark: tokensPassing }).join(),
    ).toContain("solid hex");
  });

  it("works through parseThemes", () => {
    const text = `:root {\n${css(tokensPassing)}\n}\n[data-theme="dark"] {\n${css(tokensPassing)}\n}`;
    expect(checkThemes(parseThemes(text))).toEqual([]);
  });
});

describe("findRawColors", () => {
  it.each([
    "bg-neutral-500",
    "text-white",
    "border-red-500/40",
    "hover:bg-black/10",
    'style="color: #A3231F"',
    "color: rgb(0, 0, 0)",
    "background: oklch(0.5 0 0)",
  ])("reports %s", (line) => {
    expect(findRawColors(line)).toHaveLength(1);
  });

  it.each([
    "bg-[Canvas] text-[CanvasText]",
    "bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]",
    "bg-primary text-primary-foreground border-border",
    "bg-status-success text-status-success-foreground",
    'href="#section"',
    "// bg-neutral-500 in a comment",
  ])("allows %s", (line) => {
    expect(findRawColors(line)).toEqual([]);
  });
});
