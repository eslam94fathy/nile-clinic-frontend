import { z } from "zod";

function isUsableBaseUrl(value: string): boolean {
  try {
    const { protocol, search, hash, username, password } = new URL(value);
    return (
      (protocol === "http:" || protocol === "https:") &&
      value === value.trim() &&
      // Each of these would break paths appended to the address, or the request itself.
      !search &&
      !hash &&
      !username &&
      !password
    );
  } catch {
    return false;
  }
}

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// Messages here are fixed text, so a setting's value can't reach the logs.
const envSchema = z.object({
  BACKEND_API_URL: z
    .string({ error: "is required" })
    .refine(
      isUsableBaseUrl,
      "must be an absolute http or https URL, with no query, fragment, or credentials",
    )
    .transform((url) => url.replace(/\/+$/, "")),
  CLINIC_TIMEZONE: z
    .string({ error: "must be a valid IANA time zone" })
    .refine(isTimeZone, "must be a valid IANA time zone")
    .default("Africa/Cairo"),
  DESIGN_PREVIEW_ENABLED: z
    .enum(["true", "false"], { error: "must be true or false" })
    .optional(),
});

export type ServerEnv = z.output<typeof envSchema>;

export type EnvResult =
  { ok: true; env: ServerEnv } | { ok: false; problems: string[] };

export function parseEnv(
  source: Record<string, string | undefined>,
): EnvResult {
  const result = envSchema.safeParse(source);

  if (result.success) return { ok: true, env: result.data };

  return {
    ok: false,
    problems: result.error.issues.map(
      (issue) => `${issue.path.join(".")} ${issue.message}`,
    ),
  };
}
