// Copies the backend's OpenAPI contracts into contracts/ and regenerates the types (ADR 0004).
// Usage: pnpm contracts:refresh <path-to-backend-checkout>. It only reads from the checkout.
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const sourceFile = join("contracts", "SOURCE.json");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function git(checkout, ...args) {
  return execFileSync("git", ["-C", checkout, ...args], {
    encoding: "utf8",
  }).trim();
}

const path = process.argv[2];
if (!path) fail("Usage: pnpm contracts:refresh <path-to-backend-checkout>");

const checkout = resolve(path);
const specs = join(checkout, "specs");
if (!existsSync(specs))
  fail(`Not a backend checkout: no specs folder in ${checkout}`);

let commit;
let repository;
try {
  if (git(checkout, "status", "--porcelain") !== "") {
    fail(
      "The backend checkout has uncommitted changes. Contracts must come from a commit.",
    );
  }
  commit = git(checkout, "rev-parse", "HEAD");
  repository = git(checkout, "remote", "get-url", "origin").replace(
    /\.git$/,
    "",
  );
} catch {
  fail(`Not a git checkout with an origin remote: ${checkout}`);
}

// Everything is read before anything is deleted, so a failure here leaves the snapshot intact.
const contracts = new Map();
for (const feature of readdirSync(specs)) {
  const folder = join(specs, feature, "contracts");
  if (!existsSync(folder)) continue;
  for (const file of readdirSync(folder)) {
    if (!file.endsWith(".openapi.yaml")) continue;
    if (contracts.has(file)) fail(`Two backend contracts are named ${file}.`);
    contracts.set(file, readFileSync(join(folder, file)));
  }
}
if (contracts.size === 0)
  fail("No contracts were found in the backend checkout.");

const previous = existsSync(sourceFile)
  ? JSON.parse(readFileSync(sourceFile, "utf8"))
  : null;

rmSync("contracts", { recursive: true, force: true });
mkdirSync("contracts");
for (const [file, content] of contracts) {
  writeFileSync(join("contracts", file), content);
}

// The date only changes with the commit, so refreshing an unchanged backend leaves no differences.
const copiedAt =
  previous?.commit === commit
    ? previous.copiedAt
    : new Date().toISOString().slice(0, 10);
writeFileSync(
  sourceFile,
  `${JSON.stringify({ repository, commit, copiedAt }, null, 2)}\n`,
);

console.log(`Copied ${contracts.size} contracts from ${commit}.`);
execFileSync(process.execPath, ["scripts/contracts-generate.mjs"], {
  stdio: "inherit",
});
