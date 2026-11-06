const ARABIC_INDIC_ZERO = 0x0660;
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0;

/**
 * For fee and time fields. An Arabic keyboard can type these digits, which the API's patterns refuse.
 * Everything else is left alone.
 */
export function toWesternDigits(value: string): string {
  return value
    .replace(/[\u0660-\u0669]/g, (digit) =>
      String(digit.charCodeAt(0) - ARABIC_INDIC_ZERO),
    )
    .replace(/[\u06f0-\u06f9]/g, (digit) =>
      String(digit.charCodeAt(0) - EXTENDED_ARABIC_INDIC_ZERO),
    );
}

/** For an amount, where the same keyboards also type the Arabic decimal separator. */
export function toWesternDecimal(value: string): string {
  return toWesternDigits(value).replaceAll("\u066b", ".");
}
