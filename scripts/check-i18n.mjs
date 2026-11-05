// Fails if the translation files don't have identical keys, or if a translation is empty.
import { readdirSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const isObject = (value) => typeof value === "object" && value !== null;

function collect(messages, prefix = "", entries = new Map()) {
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isObject(value)) collect(value, path, entries);
    else entries.set(path, value);
  }
  return entries;
}

export function compareMessages(byLocale) {
  const collected = Object.entries(byLocale).map(([locale, messages]) => [
    locale,
    collect(messages),
  ]);
  const allKeys = new Set(
    collected.flatMap(([, entries]) => [...entries.keys()]),
  );
  const problems = [];

  for (const key of [...allKeys].sort()) {
    for (const [locale, entries] of collected) {
      if (!entries.has(key))
        problems.push(`"${key}" is missing from ${locale}`);
      else if (String(entries.get(key)).trim() === "") {
        problems.push(`"${key}" is empty in ${locale}`);
      }
    }
  }
  return problems;
}

if (realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const folder = join("src", "messages");
  const byLocale = Object.fromEntries(
    readdirSync(folder)
      .filter((file) => file.endsWith(".json"))
      .map((file) => [
        file.replace(".json", ""),
        JSON.parse(readFileSync(join(folder, file), "utf8")),
      ]),
  );

  const problems = compareMessages(byLocale);
  if (problems.length > 0) {
    console.error("Translation files don't match:");
    for (const problem of problems) console.error(`  ${problem}`);
    process.exitCode = 1;
  } else {
    console.log(`Translations match (${Object.keys(byLocale).join(", ")}).`);
  }
}
