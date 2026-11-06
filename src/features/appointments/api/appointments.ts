import type { ApiResult } from "@/lib/api/api-error";
import { browserApi } from "@/lib/api/browser-api";
import { checkResult } from "@/lib/api/check-result";
import { itemSchema } from "@/lib/api/pagination";
import { appointmentSchema } from "../schemas/appointment";
import type { Appointment, BookingInput, RescheduleInput } from "../types";

const answerSchema = itemSchema(appointmentSchema);

function unwrapped(result: ApiResult<unknown>): ApiResult<Appointment> {
  const body = checkResult(result, answerSchema);
  return body.ok ? { ...body, data: body.data.data } : body;
}

export async function bookAppointment(
  body: BookingInput,
  locale: string,
): Promise<ApiResult<Appointment>> {
  return unwrapped(
    await browserApi("appointments", { method: "POST", json: body, locale }),
  );
}

export async function rescheduleAppointment(
  id: number,
  body: RescheduleInput,
  locale: string,
): Promise<ApiResult<Appointment>> {
  return unwrapped(
    await browserApi(`appointments/${id}/reschedule`, {
      method: "POST",
      json: body,
      locale,
    }),
  );
}

export async function cancelAppointment(
  id: number,
  body: { reason?: string },
  locale: string,
): Promise<ApiResult<Appointment>> {
  return unwrapped(
    await browserApi(`appointments/${id}/cancel`, {
      method: "POST",
      json: body,
      locale,
    }),
  );
}

export async function markNoShow(
  id: number,
  locale: string,
): Promise<ApiResult<Appointment>> {
  return unwrapped(
    await browserApi(`appointments/${id}/no-show`, {
      method: "POST",
      locale,
    }),
  );
}
