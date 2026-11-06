const ARABIC_INDIC_ZERO = 0x0660;

/**
 * For fee and time fields. An Arabic keyboard can type Arabic-Indic digits, which the API's patterns
 * refuse. Everything else is left alone.
 */
export function toWesternDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (digit) =>
    String(digit.charCodeAt(0) - ARABIC_INDIC_ZERO),
  );
}
