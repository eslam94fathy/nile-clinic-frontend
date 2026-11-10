import "server-only";
import { itemSchema, pageSchema } from "@/lib/api/pagination";
import { readResource, toQuery } from "@/lib/api/read-resource";
import { chargeSchema, chargeSummarySchema } from "../schemas/billing";
import type { ChargeFilters } from "../types";

// Neither is audited, so both are read on the server and refreshed after a change (ADR 0011, research R3).

export function readCharges(
  locale: string,
  filters: Omit<ChargeFilters, "rangeProblem" | "patientProblem">,
) {
  return readResource(
    `charges${toQuery({
      from: filters.from,
      to: filters.to,
      patient_id: filters.patientId ?? undefined,
      doctor_id: filters.doctorId ?? undefined,
      status: filters.status ?? undefined,
      page: filters.page,
    })}`,
    locale,
    pageSchema(chargeSummarySchema),
  );
}

export function readCharge(locale: string, id: number) {
  return readResource(`charges/${id}`, locale, itemSchema(chargeSchema));
}
