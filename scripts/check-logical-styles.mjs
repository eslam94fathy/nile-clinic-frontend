// Fails on physical direction styles, which break right-to-left layouts. Use logical ones instead:
// `ms-4` rather than `ml-4`, `text-start` rather than `text-left`, `margin-inline-start` in CSS.
import { readdirSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Words such as "left-to-right" in text are allowed. A class's remainder can be any value, including
// Tailwind 4's `ml-(--gap)`, colors such as `border-l-neutral-300`, and sizes such as `rounded-l-xs`.
const utility = String.raw`(?:ml|mr|pl|pr|left|right|scroll-ml|scroll-mr|scroll-pl|scroll-pr|border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br)`;
const patterns = [
  new RegExp(
    String.raw`(?<![\w-])(?:[\w-]+:)*-?${utility}-(?!to-)[\w./%:\[\]()-]+`,
  ),
  /(?<![\w-])(?:[\w-]+:)*(?:text|float|clear)-(?:left|right)(?![\w-])/,
  /(?<![\w-])(?:[\w-]+:)*(?:border-[lr]|rounded-[lr]|rounded-[tb][lr])(?=["'`\s]|$)/,
  // CSS
  /(?:margin|padding|border)-(?:left|right)(?:-[\w-]+)?\s*:/,
  /border-(?:top|bottom)-(?:left|right)-radius\s*:/,
  /(?:text-align|float|clear)\s*:\s*(?:left|right)/,
  /^\s*(?:left|right)\s*:/,
  // Inline styles
  /\b(?:margin|padding|border)(?:Left|Right)\w*\s*:/,
  /\b(?:textAlign|float|clear)\s*:\s*["'`](?:left|right)/,
  /[{,]\s*(?:left|right)\s*:/,
];

// A line starting with `*` is a comment, except a CSS universal selector such as `* {`.
const isComment = (line) =>
  /^\s*(?:\/\/|\/\*)/.test(line) || /^\s*\*(?!\s*[{,>+~])/.test(line);

export function findPhysicalStyles(text) {
  const found = [];
  text.split("\n").forEach((line, index) => {
    if (isComment(line)) return;
    for (const pattern of patterns) {
      const match = pattern.exec(line);
      if (match) {
        found.push({ line: index + 1, match: match[0].trim() });
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
    return /\.(tsx?|css)$/.test(entry.name) && !/\.test\./.test(entry.name)
      ? [path]
      : [];
  });
}

if (realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = sourceFiles("src");
  let total = 0;

  for (const file of files) {
    for (const { line, match } of findPhysicalStyles(
      readFileSync(file, "utf8"),
    )) {
      console.error(
        `${file}:${line}: "${match}" is a physical direction style`,
      );
      total += 1;
    }
  }

  if (total > 0) process.exitCode = 1;
  else
    console.log(
      `No physical direction styles (${files.length} files checked).`,
    );
}
