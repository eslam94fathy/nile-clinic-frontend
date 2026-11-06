import { formattingLocale } from "./locale";

// The contracts' `SignedMoney` pattern, which also covers `Money`.
const MONEY = /^-?\d+\.\d{2}$/;

function isMoney(value: string): value is `${number}` {
  return MONEY.test(value);
}

/**
 * Formats an amount from the API, or returns `null` if it isn't one. `Intl.NumberFormat` accepts the
 * decimal string itself, so digits are never lost to a floating-point conversion.
 */
export function formatMoney(
  value: string | null | undefined,
  locale: string,
): string | null {
  if (value == null || !isMoney(value)) return null;

  return new Intl.NumberFormat(formattingLocale(locale), {
    style: "currency",
    currency: "EGP",
  }).format(value);
}
