import "server-only";
import { parseEnv, type ServerEnv } from "./env-schema";

let cached: ServerEnv | undefined;

export function getEnv(): ServerEnv {
  if (cached) return cached;

  const result = parseEnv(process.env);
  // src/instrumentation.ts stops the server first, so this guards only unusual startups.
  if (!result.ok) throw new Error("Invalid server configuration.");

  cached = result.env;
  return cached;
}
