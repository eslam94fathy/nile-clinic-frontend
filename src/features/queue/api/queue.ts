import type { ApiResult } from "@/lib/api/api-error";
import { browserApi } from "@/lib/api/browser-api";
import { checkResult, toQuery } from "@/lib/api/check-result";
import { itemSchema, type PageMeta, pageSchema } from "@/lib/api/pagination";
import { z } from "zod";
import { ownQueueEntrySchema, queueEntrySchema } from "../schemas/queue";
import type {
  OwnQueueEntry,
  QueueEntry,
  QueueStatus,
  WalkInInput,
} from "../types";

const clinicPageSchema = pageSchema(queueEntrySchema);
const doctorListSchema = z.object({ data: z.array(queueEntrySchema) });
const ownListSchema = z.object({ data: z.array(ownQueueEntrySchema) });
const entryAnswerSchema = itemSchema(queueEntrySchema);
const ownAnswerSchema = itemSchema(ownQueueEntrySchema);

function unwrappedEntry(result: ApiResult<unknown>): ApiResult<QueueEntry> {
  const body = checkResult(result, entryAnswerSchema);
  return body.ok ? { ...body, data: body.data.data } : body;
}

function unwrappedOwn(result: ApiResult<unknown>): ApiResult<OwnQueueEntry> {
  const body = checkResult(result, ownAnswerSchema);
  return body.ok ? { ...body, data: body.data.data } : body;
}

/** The largest page the API allows, so that a day rarely needs paging at all. */
const PER_PAGE = 100;

export async function readClinicQueue(
  filters: { status: QueueStatus | null; page: number },
  locale: string,
): Promise<ApiResult<{ data: QueueEntry[]; meta: PageMeta }>> {
  const query = toQuery({
    status: filters.status ?? undefined,
    page: filters.page,
    per_page: PER_PAGE,
  });
  return checkResult(
    await browserApi(`queue${query}`, { locale }),
    clinicPageSchema,
  );
}

/** One doctor's whole list, which the API doesn't page. */
export async function readDoctorQueue(
  doctorId: number,
  locale: string,
): Promise<ApiResult<{ data: QueueEntry[] }>> {
  return checkResult(
    await browserApi(`doctors/${doctorId}/queue`, { locale }),
    doctorListSchema,
  );
}

export async function readOwnQueue(
  locale: string,
): Promise<ApiResult<{ data: OwnQueueEntry[] }>> {
  return checkResult(
    await browserApi("doctors/me/queue", { locale }),
    ownListSchema,
  );
}

export async function checkInAppointment(
  appointmentId: number,
  locale: string,
): Promise<ApiResult<QueueEntry>> {
  return unwrappedEntry(
    await browserApi(`appointments/${appointmentId}/check-in`, {
      method: "POST",
      locale,
    }),
  );
}

export async function addWalkIn(
  body: WalkInInput,
  locale: string,
): Promise<ApiResult<QueueEntry>> {
  return unwrappedEntry(
    await browserApi("queue/walk-ins", { method: "POST", json: body, locale }),
  );
}

export async function markLeft(
  entryId: number,
  locale: string,
): Promise<ApiResult<QueueEntry>> {
  return unwrappedEntry(
    await browserApi(`queue/${entryId}/leave`, { method: "POST", locale }),
  );
}

/** Answers `204`, so there's nothing to check. */
export async function undoCheckIn(
  entryId: number,
  locale: string,
): Promise<ApiResult<null>> {
  const result = await browserApi(`queue/${entryId}`, {
    method: "DELETE",
    locale,
  });
  return result.ok ? { ok: true, status: result.status, data: null } : result;
}

/** The API works out who's next, so no entry is sent. */
export async function callNext(
  locale: string,
): Promise<ApiResult<OwnQueueEntry>> {
  return unwrappedOwn(
    await browserApi("doctors/me/queue/call-next", { method: "POST", locale }),
  );
}

/** The API works out who's current, so no entry is sent. */
export async function finishVisit(
  locale: string,
): Promise<ApiResult<OwnQueueEntry>> {
  return unwrappedOwn(
    await browserApi("doctors/me/queue/finish", { method: "POST", locale }),
  );
}
