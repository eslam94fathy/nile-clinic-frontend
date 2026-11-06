"use client";

import type { ReactNode } from "react";
import { Link } from "@/lib/i18n/navigation";
import { markAsked } from "../opening";

/**
 * The only way to link to a patient's record. It never prefetches. A plain click marks the record as asked
 * for, which is how the reader tells a person opening it again from the back button (ADR 0012). A click that
 * opens another tab leaves no mark here, as that tab reads for itself.
 */
export function PatientLink({
  id,
  children,
}: {
  id: number;
  children: ReactNode;
}) {
  return (
    <Link
      href={`/patients/${id}`}
      prefetch={false}
      className="font-medium underline underline-offset-4"
      onClick={(event) => {
        const opensElsewhere =
          event.button !== 0 ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.altKey;
        if (!opensElsewhere) markAsked(id);
      }}
    >
      {children}
    </Link>
  );
}
