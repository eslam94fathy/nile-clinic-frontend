/**
 * For every field holding clinical text, asking the browser and common extensions to stay out of it: not to remember
 * it, offer it back, check it on a remote service, or suggest wording (research R9). An extension can ignore this,
 * which the privacy review records. A browser's spell check is the cost: `maxLength` is deliberately absent, as
 * cutting pasted clinical text silently is worse than a refusal that keeps it (research R3).
 */
export const CLINICAL_INPUT = {
  autoComplete: "off",
  autoCorrect: "off",
  spellCheck: false,
  writingsuggestions: "false",
  "data-gramm": "false",
  "data-enable-grammarly": "false",
} as const;
