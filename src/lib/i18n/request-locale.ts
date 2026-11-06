import { hasLocale } from "next-intl";
import { type Locale, routing } from "./routing";

/** Only an exact supported value counts, as this comes from the browser and goes on to the API. */
export function supportedLocale(
  value: string | null | undefined,
): Locale | null {
  return hasLocale(routing.locales, value) ? value : null;
}
