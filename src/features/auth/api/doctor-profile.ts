import "server-only";
import { cache } from "react";
import { z } from "zod";
import { serverApi } from "@/lib/api/server-api";

export type DoctorProfileStatus =
  "present" | "missing" | "no-session" | "forbidden" | "unknown";

/** Only for the doctor role: the API answers `403` for anyone else. Isn't an audited read. */
const readProfile = cache((locale: string) =>
  serverApi("doctors/me", { locale }),
);

export const getDoctorProfileStatus = cache(
  async (locale: string): Promise<DoctorProfileStatus> => {
    const result = await readProfile(locale);
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

const profileSchema = z.object({ data: z.object({ id: z.number() }) });

/** Differs from the account's id. It only decides what's offered, as the API decides what's allowed. */
export async function getOwnDoctorId(locale: string): Promise<number | null> {
  const result = await readProfile(locale);
  if (!result.ok) return null;

  const body = profileSchema.safeParse(result.data);
  return body.success ? body.data.data.id : null;
}
