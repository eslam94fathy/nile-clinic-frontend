"use client";

import type { ReactNode } from "react";
import { LtrText } from "@/components/shared/values/ltr-text";
import { PatientLink } from "@/features/patients/public";
import { Link } from "@/lib/i18n/navigation";
import type { AuditSubject } from "../types";

// Pages an administrator can open, which write no audit entry when opened (research R6).
const PAGES: Partial<Record<AuditSubject, string>> = {
  staff_member: "/staff",
  doctor: "/doctors",
  appointment: "/appointments",
  charge: "/charges",
};

const linkClass = "font-medium underline underline-offset-4";

/**
 * A record's number, linked to its page where an administrator has one. A patient goes through `PatientLink`, the
 * only way to a record that writes an opening, and only when clicked. Nothing here is prefetched, so showing the
 * results opens nothing. Medical records, visits, time off, and specialties have no page to go to, so stay as text.
 */
export function EntryLink({
  type,
  id,
  children,
}: {
  type: AuditSubject;
  id: number;
  /** The visible text, when it isn't just the number. */
  children?: ReactNode;
}) {
  const text = children ?? <LtrText>{String(id)}</LtrText>;

  if (type === "patient") return <PatientLink id={id}>{text}</PatientLink>;

  const page = PAGES[type];
  if (!page) return text;

  return (
    <Link href={`${page}/${String(id)}`} prefetch={false} className={linkClass}>
      {text}
    </Link>
  );
}
