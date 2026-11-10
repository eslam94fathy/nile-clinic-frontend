import {
  addDays,
  endOfPreviousMonth,
  startOfMonth,
} from "@/lib/format/clinic-today";
import type { DateRange } from "@/lib/format/date-range";
import type { ReportFilters } from "./types";

export const SHORTCUTS = [
  "today",
  "last7Days",
  "thisMonth",
  "lastMonth",
] as const;

export type Shortcut = (typeof SHORTCUTS)[number];

/** Worked out from the clinic's today on the server, never from the computer's clock (FR-005). */
export function reportShortcuts(today: string): Record<Shortcut, DateRange> {
  const lastMonthEnd = endOfPreviousMonth(today);
  return {
    today: { from: today, to: today },
    last7Days: { from: addDays(today, -6), to: today },
    thisMonth: { from: startOfMonth(today), to: today },
    lastMonth: { from: startOfMonth(lastMonthEnd), to: lastMonthEnd },
  };
}

/** The shortcut the period on screen matches, if any. The default period is this month. */
export function currentShortcut(
  filters: Pick<
    ReportFilters,
    "from" | "to" | "isDefaultPeriod" | "rangeProblem"
  >,
  shortcuts: Record<Shortcut, DateRange>,
): Shortcut | null {
  // A period the page is refusing is no shortcut, even when its one date makes it look like "Today".
  if (filters.rangeProblem !== null) return null;
  if (filters.isDefaultPeriod) return "thisMonth";
  return (
    SHORTCUTS.find(
      (name) =>
        shortcuts[name].from === filters.from &&
        shortcuts[name].to === filters.to,
    ) ?? null
  );
}
