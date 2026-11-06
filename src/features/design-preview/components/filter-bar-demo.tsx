"use client";

import { useState } from "react";
import {
  FilterBar,
  type FilterDefinition,
} from "@/components/shared/filter-bar";

/** Shows where a filter that stays out of the address ends up. */
export function FilterBarDemo({
  filters,
  privateFilter,
  appliedLabel,
}: {
  filters: FilterDefinition[];
  privateFilter: string;
  /** Contains `{value}`, as it can only be filled in here. */
  appliedLabel: string;
}) {
  const [applied, setApplied] = useState("");

  return (
    <div className="flex flex-col gap-2">
      <FilterBar
        filters={filters}
        onApply={(values) => setApplied(values[privateFilter] ?? "")}
      />
      {applied ? (
        <p role="status" className="text-muted-foreground">
          {appliedLabel.replace("{value}", applied)}
        </p>
      ) : null}
    </div>
  );
}
