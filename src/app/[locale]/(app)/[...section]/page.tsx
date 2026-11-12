import { notFound } from "next/navigation";

/**
 * Every address under a language with no page of its own: the framed not-found state. Since Phase 13 every
 * navigation entry has its page, so nothing here shows "not available yet" any more.
 */
export default function SectionPage() {
  notFound();
}
