// Fails if a declared pair of design tokens misses its WCAG contrast target in either theme, or if a
// component uses a raw color instead of a token. See docs/decisions/0008-visual-direction.md.
import { readdirSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const TEXT = 4.5;
const CONTROL = 3;

// Every pair of text on a background that the system defines, plus edges that must be visible.
export const REQUIRED_PAIRS = [
  ["foreground", "background", TEXT],
  ["foreground", "card", TEXT],
  ["foreground", "muted", TEXT],
  ["muted-foreground", "background", TEXT],
  ["muted-foreground", "card", TEXT],
  ["muted-foreground", "muted", TEXT],
  ["muted-foreground", "accent", TEXT],
  ["card-foreground", "card", TEXT],
  ["popover-foreground", "popover", TEXT],
  ["secondary-foreground", "secondary", TEXT],
  ["accent-foreground", "accent", TEXT],
  ["primary-foreground", "primary", TEXT],
  ["primary", "background", TEXT],
  ["primary", "card", TEXT],
  ["destructive-foreground", "destructive", TEXT],
  ["destructive", "background", TEXT],
  ["destructive", "card", TEXT],
  ["status-neutral-foreground", "status-neutral", TEXT],
  ["status-active-foreground", "status-active", TEXT],
  ["status-success-foreground", "status-success", TEXT],
  ["status-warning-foreground", "status-warning", TEXT],
  ["status-muted-foreground", "status-muted", TEXT],
  ["status-neutral-border", "card", CONTROL],
  ["status-active-border", "card", CONTROL],
  ["status-success-border", "card", CONTROL],
  ["status-warning-border", "card", CONTROL],
  ["status-muted-border", "card", CONTROL],
  ["input", "background", CONTROL],
  ["input", "card", CONTROL],
  // The chart's bars, a graphical object (WCAG 1.4.11). ADR 0017.
  ["chart-positive", "card", CONTROL],
  ["chart-negative", "card", CONTROL],
  ["ring", "background", CONTROL],
  ["ring", "card", CONTROL],
  ["brand", "background", CONTROL],
  ["brand-foreground", "brand", CONTROL],
  ["brand-name", "background", TEXT],
  ["brand-tagline", "background", TEXT],
];

const SOLID_HEX = /^#[0-9a-f]{6}$/i;

function luminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((value) =>
      value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(first, second) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function tokensIn(block) {
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [
      name,
      value.trim(),
    ]),
  );
}

function blockAfter(css, selector) {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) return "";
  return css.slice(start, css.indexOf("}", start));
}

export function parseThemes(css) {
  return {
    light: tokensIn(blockAfter(css, ":root")),
    dark: tokensIn(blockAfter(css, '[data-theme="dark"]')),
  };
}

export function checkThemes(themes) {
  const problems = [];

  for (const [theme, tokens] of Object.entries(themes)) {
    for (const [front, back, target] of REQUIRED_PAIRS) {
      const unusable = [front, back].filter((name) => {
        if (tokens[name] === undefined) {
          problems.push(`${theme}: --${name} is missing`);
          return true;
        }
        if (!SOLID_HEX.test(tokens[name])) {
          problems.push(`${theme}: --${name} must be a solid hex color`);
          return true;
        }
        return false;
      });
      if (unusable.length > 0) continue;

      const ratio = contrastRatio(tokens[front], tokens[back]);
      if (ratio < target) {
        problems.push(
          `${theme}: --${front} on --${back} is ${ratio.toFixed(2)}:1, needs ${target}:1`,
        );
      }
    }
  }
  return [...new Set(problems)];
}

const PALETTE = String.raw`(?:black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)`;
const PROPERTY = String.raw`(?:bg|text|border|ring|outline|fill|stroke|from|via|to|divide|shadow|accent|caret|decoration|placeholder)`;
const RAW_COLORS = [
  new RegExp(
    String.raw`(?<![\w-])(?:[\w-]+:)*${PROPERTY}-${PALETTE}(?:-\d+)?(?:/\d+)?(?![\w-])`,
  ),
  /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![\w-])/,
  /\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/,
];

const isComment = (line) => /^\s*(?:\/\/|\/\*|\*(?!\s*[{,>+~]))/.test(line);

export function findRawColors(text) {
  const found = [];
  text.split("\n").forEach((line, index) => {
    if (isComment(line)) return;
    for (const pattern of RAW_COLORS) {
      const match = pattern.exec(line);
      if (match) {
        found.push({ line: index + 1, match: match[0] });
        break;
      }
    }
  });
  return found;
}

function sourceFiles(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory())
      return entry.name === "generated" ? [] : sourceFiles(path);
    return /\.(tsx?|css)$/.test(entry.name) &&
      !/\.test\./.test(entry.name) &&
      entry.name !== "globals.css"
      ? [path]
      : [];
  });
}

if (realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = checkThemes(
    parseThemes(readFileSync(join("src", "app", "globals.css"), "utf8")),
  );

  const files = sourceFiles("src");
  for (const file of files) {
    for (const { line, match } of findRawColors(readFileSync(file, "utf8"))) {
      problems.push(`${file}:${line}: "${match}" is a raw color; use a token`);
    }
  }

  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    process.exitCode = 1;
  } else {
    console.log(
      `Contrast passes for ${REQUIRED_PAIRS.length} pairs in both themes, with no raw colors (${files.length} files checked).`,
    );
  }
}
