import { z } from "zod";

export const STAFF_ROLES = ["administrator", "receptionist", "doctor"] as const;

export type StaffFormText = {
  nameRequired: string;
  emailRequired: string;
  roleRequired: string;
  lengthRule: string;
  mismatch: string;
};

function password(text: Pick<StaffFormText, "lengthRule">) {
  return z.string().min(12, text.lengthRule).max(72, text.lengthRule);
}

export function passwordSchema(
  text: Pick<StaffFormText, "lengthRule" | "mismatch">,
) {
  return z
    .object({ password: password(text), password_confirmation: z.string() })
    .refine((values) => values.password === values.password_confirmation, {
      message: text.mismatch,
      path: ["password_confirmation"],
    });
}

export type PasswordValues = z.output<ReturnType<typeof passwordSchema>>;

function detailsShape(text: StaffFormText) {
  return {
    name: z.string().trim().min(1, text.nameRequired),
    email: z.string().trim().min(1, text.emailRequired),
    role: z.enum(STAFF_ROLES, { error: text.roleRequired }),
  };
}

export function staffCreateSchema(text: StaffFormText) {
  return z
    .object({
      ...detailsShape(text),
      password: password(text),
      password_confirmation: z.string(),
    })
    .refine((values) => values.password === values.password_confirmation, {
      message: text.mismatch,
      path: ["password_confirmation"],
    });
}

export type StaffCreateValues = z.output<ReturnType<typeof staffCreateSchema>>;

export function staffEditSchema(text: StaffFormText) {
  return z.object(detailsShape(text));
}

export type StaffEditValues = z.output<ReturnType<typeof staffEditSchema>>;
