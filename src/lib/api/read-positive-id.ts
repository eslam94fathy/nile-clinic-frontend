/** An id from an address, or null if it can't be one, so that it gives not-found with no API call. */
export function readPositiveId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;

  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}
