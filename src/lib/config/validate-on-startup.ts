import { parseEnv } from "./env-schema";

export function validateConfigurationOrExit(): void {
  const result = parseEnv(process.env);
  if (result.ok) return;

  console.error("Invalid configuration. See .env.example.");
  for (const problem of result.problems) console.error(`  ${problem}`);
  process.exit(1);
}
