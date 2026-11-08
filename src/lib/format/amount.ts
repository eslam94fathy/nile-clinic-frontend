import { toWesternDecimal } from "./digits";

// The API's rule for an amount typed in: digits, then at most two decimals (`decimal:0,2`).
const AMOUNT = /^\d+(\.\d{1,2})?$/;
const MAXIMUM = "100000";

/** What a person typed, with Western digits and a dot, as the API's patterns need. Nothing else is changed. */
export function normalizeAmount(text: string): string {
  return toWesternDecimal(text).trim();
}

/** Whole pounds without leading zeros, and exactly two decimals: text that orders the way the amounts do. */
function piastreParts(amount: string): { pounds: string; piastres: string } {
  if (!AMOUNT.test(amount)) {
    throw new Error("Not an amount.");
  }
  const [whole = "", decimals = ""] = amount.split(".");
  return {
    pounds: whole.replace(/^0+/, ""),
    piastres: decimals.padEnd(2, "0"),
  };
}

/**
 * Orders two amounts by their digits, as whole piastres, so that no floating-point number is involved at any
 * step (constitution V). Only for deciding what to offer and for checks before sending: the API decides. Throws
 * on text that isn't an amount, which a caller must check with `isAmount` first.
 */
export function compareAmounts(a: string, b: string): -1 | 0 | 1 {
  const left = piastreParts(a);
  const right = piastreParts(b);

  if (left.pounds.length !== right.pounds.length) {
    return left.pounds.length < right.pounds.length ? -1 : 1;
  }
  // Digit strings of equal length order as their values do.
  const leftText = left.pounds + left.piastres;
  const rightText = right.pounds + right.piastres;
  if (leftText === rightText) return 0;
  return leftText < rightText ? -1 : 1;
}

/** An amount as the API writes money, such as `"150.50"`, for showing what was typed. Only digits are moved. */
export function toMoneyText(amount: string): string {
  const { pounds, piastres } = piastreParts(amount);
  return `${pounds || "0"}.${piastres}`;
}

/**
 * At most two decimals and at most 100000, as every amount in the API is. Above zero unless `allowZero`, which a
 * discount needs. A check on the text, since money is never turned into a number here.
 */
export function isAmount(
  text: string,
  { allowZero = false }: { allowZero?: boolean } = {},
): boolean {
  if (!AMOUNT.test(text)) return false;
  if (compareAmounts(text, MAXIMUM) === 1) return false;
  return allowZero || compareAmounts(text, "0") === 1;
}
