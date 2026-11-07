import { z } from "zod";
import type { ApiResult } from "@/lib/api/api-error";
import { browserApi } from "@/lib/api/browser-api";
import { checkResult, toQuery } from "@/lib/api/check-result";
import { itemSchema, type PageMeta } from "@/lib/api/pagination";
import {
  addendumSchema,
  encounterSchema,
  historyPageSchema,
  visitPageSchema,
} from "../schemas/encounter";
import type {
  Addendum,
  Encounter,
  HistoryPage,
  EncounterInput,
  Visit,
} from "../types";

// Two reads here write a permanent entry each time they run: `readEncounter` and `readHistory`. They must only ever run because a person asked (ADR 0005, ADR 0012). Changes are never retried.

const encounterAnswerSchema = itemSchema(encounterSchema);
const addendumAnswerSchema = itemSchema(addendumSchema);

/** Only whose patients are on today's list is used here, and it isn't audited. */
const todaysListSchema = z.object({
  data: z.array(
    z.object({ status: z.string(), patient: z.object({ id: z.number() }) }),
  ),
});

function unwrappedEncounter(result: ApiResult<unknown>): ApiResult<Encounter> {
  const body = checkResult(result, encounterAnswerSchema);
  return body.ok ? { ...body, data: body.data.data } : body;
}

/** The largest page the API allows, so that a day needs no paging. */
const PER_PAGE = 100;

/**
 * Written each time it runs, so a person must have asked. Beside text that's only on screen, a dead session is
 * answered with `answerSessionEnd`, or reading would lose what's typed (ADR 0014).
 */
export async function readEncounter(
  id: number,
  locale: string,
  answerSessionEnd = false,
): Promise<ApiResult<Encounter>> {
  return unwrappedEncounter(
    await browserApi(`doctors/me/encounters/${id}`, {
      locale,
      ...(answerSessionEnd ? { answerSessionEnd } : {}),
    }),
  );
}

/** Written each time it runs, for each page, so a person must have asked. */
export async function readHistory(
  patientId: number,
  page: number,
  locale: string,
  answerSessionEnd = false,
): Promise<ApiResult<HistoryPage>> {
  return checkResult(
    await browserApi(
      `doctors/me/patients/${patientId}/encounters${toQuery({ page })}`,
      { locale, ...(answerSessionEnd ? { answerSessionEnd } : {}) },
    ),
    historyPageSchema,
  );
}

/** Whether the session is alive after all, as another tab may have signed in again. Not audited. */
export async function isSessionAlive(locale: string): Promise<boolean> {
  const result = await browserApi("auth/me", {
    locale,
    answerSessionEnd: true,
  });
  return result.ok;
}

/** Today's visits, for joining to the queue. Not audited, so it may refresh (ADR 0013). */
export async function readTodaysVisits(
  today: string,
  locale: string,
): Promise<ApiResult<{ data: Visit[]; meta: PageMeta }>> {
  const query = toQuery({ from: today, to: today, per_page: PER_PAGE });
  return checkResult(
    await browserApi(`doctors/me/visits${query}`, { locale }),
    visitPageSchema,
  );
}

/**
 * Who's on today's list, which only decides whether a history is offered. A dead session is answered, as it can arrive
 * once someone has started typing, and this isn't worth losing that for.
 */
export async function readTodaysList(
  locale: string,
): Promise<ApiResult<z.output<typeof todaysListSchema>>> {
  return checkResult(
    await browserApi("doctors/me/queue", { locale, answerSessionEnd: true }),
    todaysListSchema,
  );
}

export async function startEncounter(
  visitId: number,
  locale: string,
): Promise<ApiResult<Encounter>> {
  return unwrappedEncounter(
    await browserApi(`doctors/me/visits/${visitId}/encounter`, {
      method: "POST",
      locale,
    }),
  );
}

export async function saveEncounter(
  id: number,
  body: EncounterInput,
  locale: string,
): Promise<ApiResult<Encounter>> {
  return unwrappedEncounter(
    await browserApi(`doctors/me/encounters/${id}`, {
      method: "PUT",
      json: body,
      locale,
      answerSessionEnd: true,
    }),
  );
}

/** Takes no content: it locks what the API holds, so what's on screen must be saved first (research R4). */
export async function finalizeEncounter(
  id: number,
  locale: string,
): Promise<ApiResult<Encounter>> {
  return unwrappedEncounter(
    await browserApi(`doctors/me/encounters/${id}/finalize`, {
      method: "POST",
      locale,
      answerSessionEnd: true,
    }),
  );
}

export async function addAddendum(
  id: number,
  text: string,
  locale: string,
): Promise<ApiResult<Addendum>> {
  const body = checkResult(
    await browserApi(`doctors/me/encounters/${id}/addenda`, {
      method: "POST",
      json: { text },
      locale,
      answerSessionEnd: true,
    }),
    addendumAnswerSchema,
  );
  return body.ok ? { ...body, data: body.data.data } : body;
}
