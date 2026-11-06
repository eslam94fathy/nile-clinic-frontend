// The one setting for digits: Western in both languages (ADR 0008). Plain `ar` can't be relied on,
// since `ar-EG` already gives Eastern digits. Use "arab" here to change every display at once.
const NUMBERING_SYSTEM = "latn";

export function formattingLocale(locale: string): string {
  return `${locale}-u-nu-${NUMBERING_SYSTEM}`;
}

export function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(formattingLocale(locale)).format(value);
}
