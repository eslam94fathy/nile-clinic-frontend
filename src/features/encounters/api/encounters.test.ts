import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addAddendum,
  finalizeEncounter,
  isSessionAlive,
  readEncounter,
  readHistory,
  readTodaysList,
  readTodaysVisits,
  saveEncounter,
  startEncounter,
} from "./encounters";

const browserApi = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/browser-api", () => ({ browserApi }));

const patient = {
  id: 1,
  full_name: "Synthetic Patient",
  sex: "female",
  date_of_birth: "1990-01-01",
};
const record = {
  id: 3,
  visit_id: 7,
  status: "draft",
  date: "2026-11-07",
  doctor: { id: 2, name: "Synthetic Doctor", title: "Consultant" },
  patient,
  chief_complaint: null,
  examination_findings: null,
  diagnosis: null,
  treatment_plan: null,
  prescriptions: [],
  addenda: [],
  started_at: "2026-11-07T08:00:00.000000Z",
  last_saved_at: "2026-11-07T08:00:00.000000Z",
  finalized_at: null,
};
const meta = {
  current_page: 1,
  last_page: 1,
  per_page: 15,
  total: 0,
  from: null,
  to: null,
};
const answers = (data: unknown) => ({ ok: true, status: 200, data });
const body = {
  chief_complaint: null,
  examination_findings: null,
  diagnosis: null,
  treatment_plan: null,
  prescriptions: [],
};

beforeEach(() => {
  browserApi.mockReset();
  browserApi.mockResolvedValue(answers({ data: record }));
});

describe("reads", () => {
  it("reads a record, leaving a dead session to end", async () => {
    const result = await readEncounter(3, "en");
    expect(result).toMatchObject({ ok: true, data: { id: 3 } });
    expect(browserApi).toHaveBeenCalledWith("doctors/me/encounters/3", {
      locale: "en",
    });
  });

  it("reads a history's page", async () => {
    browserApi.mockResolvedValue(answers({ data: [], meta }));
    await readHistory(1, 2, "ar");
    expect(browserApi).toHaveBeenCalledWith(
      "doctors/me/patients/1/encounters?page=2",
      { locale: "ar" },
    );
  });

  it("says whether the session is alive, without ending it", async () => {
    browserApi.mockResolvedValue(answers({ data: {} }));
    expect(await isSessionAlive("en")).toBe(true);
    expect(browserApi).toHaveBeenCalledWith("auth/me", {
      locale: "en",
      answerSessionEnd: true,
    });

    browserApi.mockResolvedValue({
      ok: false,
      error: { status: 401, fieldErrors: {} },
    });
    expect(await isSessionAlive("en")).toBe(false);
  });

  it("answers a dead session when asked, keeping what's typed", async () => {
    await readEncounter(3, "en", true);
    expect(browserApi).toHaveBeenLastCalledWith("doctors/me/encounters/3", {
      locale: "en",
      answerSessionEnd: true,
    });

    browserApi.mockResolvedValue(answers({ data: [], meta }));
    await readHistory(1, 1, "en", true);
    expect(browserApi).toHaveBeenLastCalledWith(
      "doctors/me/patients/1/encounters?page=1",
      { locale: "en", answerSessionEnd: true },
    );
  });

  it("reads one day's visits in the largest page", async () => {
    browserApi.mockResolvedValue(answers({ data: [], meta }));
    await readTodaysVisits("2026-11-07", "en");
    expect(browserApi).toHaveBeenCalledWith(
      "doctors/me/visits?from=2026-11-07&to=2026-11-07&per_page=100",
      { locale: "en" },
    );
  });

  it("reads today's list", async () => {
    browserApi.mockResolvedValue(
      answers({ data: [{ status: "waiting", patient: { id: 1 } }] }),
    );
    const result = await readTodaysList("en");
    expect(result).toMatchObject({ ok: true });
    expect(browserApi).toHaveBeenCalledWith("doctors/me/queue", {
      locale: "en",
      answerSessionEnd: true,
    });
  });

  it("treats a body it doesn't recognise as a failed read", async () => {
    browserApi.mockResolvedValue(answers({ data: { id: "wrong" } }));
    expect(await readEncounter(3, "en")).toMatchObject({
      ok: false,
      error: { status: 0 },
    });
  });
});

describe("changes", () => {
  it("starts a record, sending nothing", async () => {
    await startEncounter(7, "en");
    expect(browserApi).toHaveBeenCalledWith("doctors/me/visits/7/encounter", {
      method: "POST",
      locale: "en",
    });
  });

  it("saves the whole draft", async () => {
    await saveEncounter(3, body, "en");
    expect(browserApi).toHaveBeenCalledWith("doctors/me/encounters/3", {
      method: "PUT",
      json: body,
      locale: "en",
      answerSessionEnd: true,
    });
  });

  it("finalizes, sending nothing", async () => {
    await finalizeEncounter(3, "en");
    expect(browserApi).toHaveBeenCalledWith(
      "doctors/me/encounters/3/finalize",
      { method: "POST", locale: "en", answerSessionEnd: true },
    );
  });

  it("adds an addendum, and gives back only the addendum", async () => {
    const addendum = {
      id: 9,
      text: "Synthetic",
      created_at: "2026-11-07T09:00:00.000000Z",
    };
    browserApi.mockResolvedValue(answers({ data: addendum }));

    const result = await addAddendum(3, "Synthetic", "en");

    expect(browserApi).toHaveBeenCalledWith("doctors/me/encounters/3/addenda", {
      method: "POST",
      json: { text: "Synthetic" },
      locale: "en",
      answerSessionEnd: true,
    });
    expect(result).toMatchObject({ ok: true, data: addendum });
  });

  it("passes a refusal on untouched, including a 401 it was asked to answer", async () => {
    const error = { status: 401, fieldErrors: {} };
    browserApi.mockResolvedValue({ ok: false, error });
    expect(await saveEncounter(3, body, "en")).toEqual({ ok: false, error });
  });
});
