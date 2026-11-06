import { z } from "zod";

/** Fast feedback only: whether the details are right is the API's answer. */
export function signInSchema(messages: {
  emailRequired: string;
  passwordRequired: string;
}) {
  return z.object({
    email: z.string().min(1, messages.emailRequired),
    password: z.string().min(1, messages.passwordRequired),
  });
}

export type SignInValues = z.infer<ReturnType<typeof signInSchema>>;
