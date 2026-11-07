// Each read of an audited record writes a permanent entry, so these say what a person actually did. All of it
// lives in memory only, and a full page load, which sign-out always is, clears it (ADR 0012).

// A navigation that's overtaken never reaches the reader, so what it left here must not last. Otherwise the back
// button could find it later, and write an opening that nobody asked for. A navigation slower than this shows
// what's held, and asking to read again is still there.
const LIFETIME_MS = 15_000;
const stillFresh = (at: number) => Date.now() - at < LIFETIME_MS;

export type AuditedOpening<Record extends { id: number }> = {
  /** A record the API has just returned, so that showing it doesn't need a read that nobody asked for. */
  handOver: (record: Record) => void;
  takeHandedOver: (id: number) => Record | null;
  /** A person clicked a link to this record. Only a click can say so: the back button leaves no such mark. */
  markAsked: (id: number) => void;
  takeAsked: (id: number) => boolean;
};

export function createAuditedOpening<
  Record extends { id: number },
>(): AuditedOpening<Record> {
  let handedOver: { record: Record; at: number } | null = null;
  const asked = new Map<number, number>();

  return {
    handOver(record) {
      handedOver = { record, at: Date.now() };
    },
    takeHandedOver(id) {
      if (handedOver?.record.id !== id) return null;

      const { record, at } = handedOver;
      handedOver = null;
      return stillFresh(at) ? record : null;
    },
    markAsked(id) {
      asked.set(id, Date.now());
    },
    takeAsked(id) {
      const at = asked.get(id);
      asked.delete(id);
      return at !== undefined && stillFresh(at);
    },
  };
}
