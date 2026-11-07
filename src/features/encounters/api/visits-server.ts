import "server-only";
import { readResource, toQuery } from "@/lib/api/read-resource";
import { visitPageSchema } from "../schemas/encounter";
import type { VisitFilters } from "../types";

/** Holds no clinical content and writes no audit entry, so it's read on the server, as other lists are (ADR 0011). */
export function readVisits(locale: string, filters: VisitFilters) {
  return readResource(
    `doctors/me/visits${toQuery(filters)}`,
    locale,
    visitPageSchema,
  );
}
