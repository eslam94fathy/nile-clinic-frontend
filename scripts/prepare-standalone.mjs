// Puts the static files beside the standalone server, as the Docker image does, so that tests run the server
// that ships (ADR 0022). `next build` leaves them out of `.next/standalone` on purpose.
import { cpSync, existsSync, rmSync } from "node:fs";

const server = ".next/standalone";
if (!existsSync(`${server}/server.js`)) {
  console.error(`No ${server}/server.js. Run \`next build\` first.`);
  process.exit(1);
}

for (const [from, to] of [
  [".next/static", `${server}/.next/static`],
  ["public", `${server}/public`],
]) {
  rmSync(to, { recursive: true, force: true });
  if (existsSync(from)) cpSync(from, to, { recursive: true });
}
