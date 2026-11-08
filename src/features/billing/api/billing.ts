import type { ApiResult } from "@/lib/api/api-error";
import { browserApi } from "@/lib/api/browser-api";
import { checkResult, toQuery } from "@/lib/api/check-result";
import { itemSchema, type PageMeta, pageSchema } from "@/lib/api/pagination";
import { chargeSchema, visitChargeSchema } from "../schemas/billing";
import type {
  BillingFilters,
  Charge,
  PaymentMethod,
  VisitCharge,
} from "../types";

// None of these is ever retried: `browserApi` never retries a change, and nothing here calls twice (research R4).

const visitPageSchema = pageSchema(visitChargeSchema);
const chargeAnswerSchema = itemSchema(chargeSchema);

/** The largest page the API allows, so that a day rarely needs paging at all. */
const PER_PAGE = 100;

/** A change's answer is the whole charge. A body that fails the check is reported as having no usable answer. */
function unwrappedCharge(result: ApiResult<unknown>): ApiResult<Charge> {
  const body = checkResult(result, chargeAnswerSchema);
  return body.ok ? { ...body, data: body.data.data } : body;
}

/** Not audited, so it may read by itself (ADR 0015). */
export async function readVisits(
  filters: Pick<BillingFilters, "date" | "doctorId" | "chargeStatus" | "page">,
  locale: string,
): Promise<ApiResult<{ data: VisitCharge[]; meta: PageMeta }>> {
  const query = toQuery({
    date: filters.date,
    doctor_id: filters.doctorId ?? undefined,
    charge_status: filters.chargeStatus ?? undefined,
    page: filters.page,
    per_page: PER_PAGE,
  });
  return checkResult(
    await browserApi(`visits${query}`, { locale }),
    visitPageSchema,
  );
}

/** At the doctor's fee at this moment, so no amount is sent (FR-005). */
export async function chargeVisit(
  visitId: number,
  locale: string,
): Promise<ApiResult<Charge>> {
  return unwrappedCharge(
    await browserApi(`visits/${visitId}/charge`, { method: "POST", locale }),
  );
}

export async function recordPayment(
  chargeId: number,
  body: { amount: string; method: PaymentMethod },
  locale: string,
): Promise<ApiResult<Charge>> {
  return unwrappedCharge(
    await browserApi(`charges/${chargeId}/payments`, {
      method: "POST",
      json: body,
      locale,
    }),
  );
}

export async function recordRefund(
  chargeId: number,
  body: { amount: string; method: PaymentMethod; reason: string },
  locale: string,
): Promise<ApiResult<Charge>> {
  return unwrappedCharge(
    await browserApi(`charges/${chargeId}/refunds`, {
      method: "POST",
      json: body,
      locale,
    }),
  );
}

/** Replaces any discount. Zero removes it. */
export async function setDiscount(
  chargeId: number,
  body: { amount: string; reason: string },
  locale: string,
): Promise<ApiResult<Charge>> {
  return unwrappedCharge(
    await browserApi(`charges/${chargeId}/discount`, {
      method: "PUT",
      json: body,
      locale,
    }),
  );
}

export async function cancelCharge(
  chargeId: number,
  body: { reason: string },
  locale: string,
): Promise<ApiResult<Charge>> {
  return unwrappedCharge(
    await browserApi(`charges/${chargeId}/cancel`, {
      method: "POST",
      json: body,
      locale,
    }),
  );
}
