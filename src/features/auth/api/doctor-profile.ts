import "server-only";
import { cache } from "react";
import { serverApi } from "@/lib/api/server-api";

export type DoctorProfileStatus =
  "present" | "missing" | "no-session" | "forbidden" | "unknown";

/** Only for the doctor role: the API answers `403` for anyone else. Isn't an audited read. */
export const getDoctorProfileStatus = cache(
  async (locale: string): Promise<DoctorProfileStatus> => {
    const result = await serverApi("doctors/me", { locale });
    if (result.ok) return "present";

    switch (result.error.status) {
      case 404:
        return "missing";
      case 401:
        return "no-session";
      case 403:
        return "forbidden";
      default:
        return "unknown";
    }
  },
);
