"use client";

import type { ReactNode } from "react";
import { AuditedLink } from "@/components/shared/audited-link";
import { recordOpening } from "../opening";

/** The only way to link to a record, as following it writes a true `encounter.opened` (ADR 0012). */
export function RecordLink({
  id,
  children,
}: {
  id: number;
  children: ReactNode;
}) {
  return (
    <AuditedLink
      href={`/my/encounters/${id}`}
      onAsked={() => recordOpening.markAsked(id)}
    >
      {children}
    </AuditedLink>
  );
}
