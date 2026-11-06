const CLINIC_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return isLeap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/**
 * Returns a clinic date exactly as sent, or `null` if it isn't a real date. This deliberately never
 * uses `Date`, which reads such a string as UTC and can show the wrong day.
 */
export function readClinicDate(
  value: string | null | undefined,
): string | null {
  const match = value == null ? null : CLINIC_DATE.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const isReal =
    month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
  return isReal ? match[0] : null;
}
