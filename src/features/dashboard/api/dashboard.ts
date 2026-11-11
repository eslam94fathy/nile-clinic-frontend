import type { z } from "zod";
import { UPCOMING_DAYS } from "@/features/appointments/public";
import type { ApiResult } from "@/lib/api/api-error";
import { browserApi } from "@/lib/api/browser-api";
import { checkResult, toQuery } from "@/lib/api/check-result";
import { addDays } from "@/lib/format/clinic-today";
import { allSucceeded, firstRefusal } from "../first-refusal";
import {
  activityPageSchema,
  appointmentRowSchema,
  countPageSchema,
  moneyTodaySchema,
  ownAppointmentRowSchema,
  ownQueueSchema,
  shortPageSchema,
} from "../schemas/dashboard";
import type {
  ActivityTodayPanel,
  Count,
  MoneyOwed,
  MoneyTodayPanel,
  NeedingAMove,
  NextOwnAppointments,
  OwnQueue,
  OwnRecords,
  QueueByStatus,
  ShortList,
  TodaysAppointments,
} from "../types";

// Every read here is one the backend doesn't audit (contracts/api-usage.md), so a panel may read by itself (ADR 0019).
// Never add a patient's record, a medical record, a patient's history, or the audit trail here: each writes a
// permanent entry when read. No read asks for a second page: a figure is a list's total, from one row.

/** One row is enough to learn a list's total. */
const COUNT_PAGE = 1;
/** A panel's short list. */
const LIST_PAGE = 5;
/** The API's longest range for a doctor's visits, both ends included. */
const OWN_VISIT_DAYS = 92;

type Query = Record<string, string | number | undefined>;

const failed = <Data>(
  results: readonly ApiResult<unknown>[],
): ApiResult<Data> => ({
  ok: false,
  error: firstRefusal(results),
});

const succeeded = <Data>(data: Data): ApiResult<Data> => ({
  ok: true,
  status: 200,
  data,
});

async function count(
  path: string,
  query: Query,
  locale: string,
): Promise<ApiResult<Count>> {
  const result = checkResult(
    await browserApi(`${path}${toQuery({ ...query, per_page: COUNT_PAGE })}`, {
      locale,
    }),
    countPageSchema,
  );
  return result.ok ? succeeded(result.data.meta.total) : result;
}

async function shortList<Row extends z.ZodType>(
  path: string,
  query: Query,
  row: Row,
  locale: string,
): Promise<ApiResult<ShortList<z.output<Row>>>> {
  const result = checkResult(
    await browserApi(`${path}${toQuery({ ...query, per_page: LIST_PAGE })}`, {
      locale,
    }),
    shortPageSchema(row),
  );
  return result.ok
    ? succeeded({ rows: result.data.data, total: result.data.meta.total })
    : result;
}

// Receptionist

export async function readTodaysAppointments(
  today: string,
  locale: string,
): Promise<ApiResult<TodaysAppointments>> {
  const day = { from: today, to: today };
  const results = await Promise.all([
    shortList(
      "appointments",
      { ...day, status: "scheduled" },
      appointmentRowSchema,
      locale,
    ),
    count("appointments", { ...day, status: "checked_in" }, locale),
    count("appointments", { ...day, status: "completed" }, locale),
    count("appointments", { ...day, status: "no_show" }, locale),
  ] as const);
  if (!allSucceeded(results)) return failed(results);

  const [toArrive, arrived, completed, noShow] = results;
  return succeeded({
    today,
    toArrive: toArrive.data,
    arrived: arrived.data,
    completed: completed.data,
    noShow: noShow.data,
  });
}

/** The queue is always the clinic's today, so no date is sent. */
export async function readQueueByStatus(
  locale: string,
): Promise<ApiResult<QueueByStatus>> {
  const results = await Promise.all([
    count("queue", { status: "waiting" }, locale),
    count("queue", { status: "with_doctor" }, locale),
    count("queue", { status: "seen" }, locale),
    count("queue", { status: "left" }, locale),
  ] as const);
  if (!allSucceeded(results)) return failed(results);

  const [waiting, withDoctor, seen, left] = results;
  return succeeded({
    waiting: waiting.data,
    withDoctor: withDoctor.data,
    seen: seen.data,
    // The backend's status, not a direction. Computed, so the logical-styles check can stay strict.
    ["left"]: left.data,
  });
}

/** "Not charged" is every visit today with no active charge, whatever its queue status, as Billing's filter is. */
export async function readMoneyOwed(
  today: string,
  locale: string,
): Promise<ApiResult<MoneyOwed>> {
  const results = await Promise.all([
    count("visits", { date: today, charge_status: "none" }, locale),
    count("visits", { date: today, charge_status: "unpaid" }, locale),
    count("visits", { date: today, charge_status: "partially_paid" }, locale),
  ] as const);
  if (!allSucceeded(results)) return failed(results);

  const [notCharged, unpaid, partlyPaid] = results;
  return succeeded({
    today,
    notCharged: notCharged.data,
    unpaid: unpaid.data,
    partlyPaid: partlyPaid.data,
  });
}

/** The same period as the Appointments screen's own "needing a move" list, so the two agree. */
export async function readNeedingAMove(
  today: string,
  locale: string,
): Promise<ApiResult<NeedingAMove>> {
  const to = addDays(today, UPCOMING_DAYS);
  const list = await shortList(
    "appointments",
    { from: today, to, outside_availability: 1 },
    appointmentRowSchema,
    locale,
  );
  return list.ok ? succeeded({ from: today, to, list: list.data }) : list;
}

// Doctor

/** The doctor's whole list for today: whoever is with them, and everyone waiting, in the API's order. */
export async function readOwnQueue(
  locale: string,
): Promise<ApiResult<OwnQueue>> {
  const result = checkResult(
    await browserApi("doctors/me/queue", { locale }),
    ownQueueSchema,
  );
  if (!result.ok) return result;

  const entries = result.data.data;
  return succeeded({
    current: entries.find(({ status }) => status === "with_doctor") ?? null,
    waiting: entries.filter(({ status }) => status === "waiting"),
  });
}

export function readNextOwnAppointments(
  today: string,
  locale: string,
): Promise<ApiResult<NextOwnAppointments>> {
  return shortList(
    "doctors/me/appointments",
    { from: today, to: today, status: "scheduled" },
    ownAppointmentRowSchema,
    locale,
  );
}

/** Over the longest period one request allows, ending today (clarified 2026-11-11). */
export async function readOwnRecords(
  today: string,
  locale: string,
): Promise<ApiResult<OwnRecords>> {
  const from = addDays(today, -(OWN_VISIT_DAYS - 1));
  const period = { from, to: today };
  const results = await Promise.all([
    count("doctors/me/visits", { ...period, record_status: "none" }, locale),
    count("doctors/me/visits", { ...period, record_status: "draft" }, locale),
  ] as const);
  if (!allSucceeded(results)) return failed(results);

  const [none, draft] = results;
  return succeeded({ ...period, none: none.data, draft: draft.data });
}

// Administrator

export async function readMoneyToday(
  today: string,
  locale: string,
): Promise<ApiResult<MoneyTodayPanel>> {
  const result = checkResult(
    await browserApi(
      `reports/money-collected${toQuery({ from: today, to: today })}`,
      { locale },
    ),
    moneyTodaySchema,
  );
  return result.ok ? succeeded({ today, money: result.data.data }) : result;
}

/** Only the totals are used, which cover every doctor whichever page of doctors comes back. */
export async function readActivityToday(
  today: string,
  locale: string,
): Promise<ApiResult<ActivityTodayPanel>> {
  const result = checkResult(
    await browserApi(`reports/activity${toQuery({ from: today, to: today })}`, {
      locale,
    }),
    activityPageSchema,
  );
  return result.ok ? succeeded({ today, totals: result.data.totals }) : result;
}
