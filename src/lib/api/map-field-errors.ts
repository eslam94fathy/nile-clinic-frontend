import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ApiError } from "./api-error";

/**
 * Puts the API's errors on their form fields, and returns the rest for the form level, so that none is
 * dropped. A message that is the only thing the API sent goes to the form level too. If that leaves the
 * person with nothing to read, the form level gets `fallback`.
 */
export function mapFieldErrors<Values extends FieldValues>(
  error: ApiError,
  fields: readonly Path<Values>[],
  setError: UseFormSetError<Values>,
  fallback: string,
): string[] {
  const known = new Set<string>(fields);
  const formLevel: string[] = [];
  let shownOnField = false;

  for (const [key, messages] of Object.entries(error.fieldErrors)) {
    if (known.has(key)) {
      // `known` was built from `fields`, so this key is one of them.
      setError(key as Path<Values>, {
        type: "server",
        message: messages.join(" "),
      });
      shownOnField = true;
    } else {
      formLevel.push(...messages);
    }
  }

  if (Object.keys(error.fieldErrors).length === 0 && error.message) {
    formLevel.push(error.message);
  }
  return formLevel.length > 0 || shownOnField ? formLevel : [fallback];
}
