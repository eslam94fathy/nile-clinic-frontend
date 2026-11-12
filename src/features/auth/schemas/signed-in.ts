import { z } from "zod";
import { staffMemberSchema } from "./staff-member";

/** The backend's answer to a sign-in. Only route handlers see it, as it holds the token. */
export const signedInSchema = z.object({
  data: z.object({ token: z.string().min(1), user: staffMemberSchema }),
});
