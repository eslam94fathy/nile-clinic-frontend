"use client";

import type { ReactNode } from "react";
import { Link } from "@/lib/i18n/navigation";

/**
 * The only way to link to a page that writes an audit entry when opened. It never prefetches. A plain click tells
 * the reader a person asked for it, which is how it tells them from the back button (ADR 0012). A click that opens
 * another tab says nothing here, as that tab reads for itself.
 */
export function AuditedLink({
  href,
  onAsked,
  className = "font-medium underline underline-offset-4",
  children,
}: {
  href: string;
  onAsked: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={className}
      onClick={(event) => {
        const opensElsewhere =
          event.button !== 0 ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.altKey;
        if (!opensElsewhere) onAsked();
      }}
    >
      {children}
    </Link>
  );
}
