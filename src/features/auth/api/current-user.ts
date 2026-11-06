import "server-only";
import { cache } from "react";
import { z } from "zod";
import { serverApi } from "@/lib/api/server-api";
import { staffMemberSchema } from "../schemas/staff-member";
import type { StaffMember } from "../types";

export type CurrentUser =
  | { kind: "signed-in"; user: StaffMember }
  | { kind: "no-session" }
  | { kind: "unavailable" };

const responseSchema = z.object({ data: staffMemberSchema });

/**
 * Asked of the API on each request, so a changed role or ended session shows at once. `cache` shares the
 * answer within one render, and never between requests or people.
 */
export const getCurrentUser = cache(
  async (locale: string): Promise<CurrentUser> => {
    const result = await serverApi("auth/me", { locale });

    if (!result.ok) {
      return result.error.status === 401
        ? { kind: "no-session" }
        : { kind: "unavailable" };
    }

    const body = responseSchema.safeParse(result.data);
    return body.success
      ? { kind: "signed-in", user: body.data.data }
      : { kind: "unavailable" };
  },
);
