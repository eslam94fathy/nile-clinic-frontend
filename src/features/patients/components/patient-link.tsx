"use client";

import type { ReactNode } from "react";
import { AuditedLink } from "@/components/shared/audited-link";
import { markAsked } from "../opening";

/** The only way to link to a patient's record (ADR 0012). */
export function PatientLink({
  id,
  children,
}: {
  id: number;
  children: ReactNode;
}) {
  return (
    <AuditedLink href={`/patients/${id}`} onAsked={() => markAsked(id)}>
      {children}
    </AuditedLink>
  );
}
