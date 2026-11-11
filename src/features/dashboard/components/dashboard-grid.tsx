import type { ReactNode } from "react";

/** One column at narrow widths, two at a desk's. */
export function DashboardGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{children}</div>
  );
}
