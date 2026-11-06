import { z } from "zod";

/** Fast feedback only. The API's answer always wins. */
export function changePasswordSchema(messages: {
  currentRequired: string;
  lengthRule: string;
  mismatch: string;
}) {
  return z
    .object({
      current_password: z.string().min(1, messages.currentRequired),
      password: z
        .string()
        .min(12, messages.lengthRule)
        .max(72, messages.lengthRule),
      password_confirmation: z.string(),
    })
    .refine((values) => values.password === values.password_confirmation, {
      message: messages.mismatch,
      path: ["password_confirmation"],
    });
}

export type ChangePasswordValues = z.infer<
  ReturnType<typeof changePasswordSchema>
>;
