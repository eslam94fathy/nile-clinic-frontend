import type { components } from "@/lib/api/generated/health";

export type Health = components["schemas"]["Health"];

export const SYSTEM_STATUS_REGION_ID = "system-status";

/** The result of one check against the backend. */
export type ConnectivityStatus = "working" | "unavailable" | "unreachable";
