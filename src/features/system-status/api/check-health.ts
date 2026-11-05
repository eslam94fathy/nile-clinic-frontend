import "server-only";
import { getEnv } from "@/lib/config/env";
import { classifyHealth } from "../classify-health";
import type { ConnectivityStatus } from "../types";

const TIMEOUT_MS = 5000;

export async function checkHealth(locale: string): Promise<ConnectivityStatus> {
  try {
    const response = await fetch(`${getEnv().BACKEND_API_URL}/health`, {
      headers: { Accept: "application/json", "Accept-Language": locale },
      cache: "no-store",
      // A redirect means this isn't the backend, so it must not be followed to a healthy answer.
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const body: unknown = await response.json().catch(() => null);
    return classifyHealth(response.status, body);
  } catch {
    return "unreachable";
  }
}
