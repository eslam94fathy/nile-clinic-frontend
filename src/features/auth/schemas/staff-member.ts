import { z } from "zod";
import type { StaffMember } from "../types";

// Checks what crosses the server boundary. The type comes from the contract, not from here.
export const staffMemberSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  role: z.enum(["administrator", "receptionist", "doctor"]),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
}) satisfies z.ZodType<StaffMember>;
